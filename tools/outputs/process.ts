import { execFile, spawn } from 'node:child_process'
import type { ChildProcess, SpawnOptions, StdioOptions } from 'node:child_process'
import { basename } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'
import { accessVariable, childAccess, currentAccess, ownChild } from './access'

/** Process inputs for a finite engineering command. */
export interface ProcessOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  signal?: AbortSignal
}

/** A child failure with bounded captured diagnostics, when capture was requested. */
export class CommandFailed extends Error {
  readonly exitCode: number
  constructor(
    command: string,
    code: number | null,
    signal: string | null,
    readonly stdout = '',
    readonly stderr = '',
  ) {
    super(`Tool failed: ${basename(command)} (${signal ?? code})`)
    this.exitCode = code && code > 0 ? code : 1
  }
}

/** Spawn an owned child, sharing lock descriptors; product children may omit the tooling context. */
export function spawnWithOutputs(
  command: string,
  args: string[],
  options: Omit<SpawnOptions, 'signal' | 'shell'> & { inheritAccessContext?: boolean } = {},
): ChildProcess {
  const { inheritAccessContext = true, ...spawnOptions } = options
  if (process.platform === 'win32' && spawnOptions.detached) {
    throw new Error('Owned Windows child processes must remain attached')
  }
  const declared = spawnOptions.stdio ?? ['ignore', 'inherit', 'inherit']
  const stdio: StdioOptions =
    typeof declared === 'string' ? [declared, declared, declared] : [...declared]
  while (stdio.length < 3) stdio.push('ignore')
  const access = childAccess(stdio.length)
  const env = { ...process.env, ...spawnOptions.env }
  if (inheritAccessContext) Object.assign(env, access.env)
  else delete env[accessVariable]

  const child = spawn(command, args, {
    windowsHide: true,
    ...spawnOptions,
    env,
    stdio: [...stdio, ...access.descriptors],
  })
  ownChild(new Promise<void>((resolve) => child.once('close', () => resolve())))
  return child
}

/** Terminate only the spawned command's tree; retained descriptors protect any surviving Unix I/O. */
async function stopCommand(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return
  if (process.platform === 'win32') {
    try {
      await promisify(execFile)('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        windowsHide: true,
      })
    } catch (cause) {
      if (child.exitCode === null && child.signalCode === null) throw cause
    }
    return
  }
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== 'ESRCH') throw cause
    return
  }
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    try {
      process.kill(-child.pid, 0)
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== 'ESRCH') throw cause
      return
    }
    await delay(50)
  }
  // The owned group gets five seconds to stop normally before forced termination.
  try {
    process.kill(-child.pid, 'SIGKILL')
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== 'ESRCH') throw cause
  }
}

/** Wait for command closure and cancellation completion; spawn errors never release access early. */
async function execute(
  command: string,
  args: string[],
  options: ProcessOptions,
  capture: boolean,
): Promise<string> {
  const limit = new AbortController()
  const signals = [limit.signal]
  const ownedSignal = currentAccess()?.signal
  if (ownedSignal) signals.push(ownedSignal)
  if (options.signal) signals.push(options.signal)
  const signal = AbortSignal.any(signals)
  signal.throwIfAborted()
  const child = spawnWithOutputs(command, args, {
    ...(options.cwd ? { cwd: options.cwd } : {}),
    ...(options.env ? { env: options.env } : {}),
    detached: process.platform !== 'win32',
    stdio: ['ignore', capture ? 'pipe' : 'inherit', capture ? 'pipe' : 'inherit'],
  })
  let failure: unknown
  let stopping: Promise<void> | undefined
  let stdout = ''
  let stderr = ''
  let size = 0
  const cancel = () => {
    stopping ??= stopCommand(child).catch((cause: unknown) => {
      failure = cause
    })
  }
  signal.addEventListener('abort', cancel, { once: true })
  if (signal.aborted) cancel()
  child.once('error', (cause) => {
    failure = cause
  })

  /** Bound output before appending it, then cancel and await the actual child on overflow. */
  function collect(value: string, error: boolean): void {
    size += Buffer.byteLength(value)
    if (size > 1024 * 1024) {
      limit.abort(new Error('Captured tool output exceeds 1 MiB'))
      return
    }
    if (error) stderr += value
    else stdout += value
  }
  child.stdout?.setEncoding('utf8').on('data', (value: string) => collect(value, false))
  child.stderr?.setEncoding('utf8').on('data', (value: string) => collect(value, true))

  try {
    const result = await new Promise<{ code: number | null; signal: string | null }>((resolve) => {
      child.once('close', (code, exitSignal) => resolve({ code, signal: exitSignal }))
    })
    await stopping
    if (failure) throw failure
    signal.throwIfAborted()
    if (result.code !== 0) {
      throw new CommandFailed(command, result.code, result.signal, stdout, stderr)
    }
    return stdout
  } finally {
    signal.removeEventListener('abort', cancel)
  }
}

/** Execute a finite command and forward its diagnostics, retaining any active output access. */
export async function run(
  command: string,
  args: string[],
  options: ProcessOptions = {},
): Promise<void> {
  await execute(command, args, options, false)
}

/** Resolve the pinned pnpm executable that started this project task. */
function pnpmCommand(args: string[]): { command: string; args: string[] } {
  const executable = process.env.npm_execpath
  if (!executable) throw new Error('Run this workflow through its pnpm project task')
  return executable.endsWith('.exe')
    ? { command: executable, args }
    : { command: process.execPath, args: [executable, ...args] }
}

/** Run pnpm under the caller's access; command completion includes closed output streams. */
export async function runPnpm(args: string[], options: ProcessOptions = {}): Promise<void> {
  const invocation = pnpmCommand(args)
  await run(invocation.command, invocation.args, options)
}

/** Capture bounded standard output from pnpm; the caller owns any required output locks. */
export async function readPnpm(
  args: string[],
  cwd: string,
  options: ProcessOptions = {},
): Promise<string> {
  const invocation = pnpmCommand(args)
  return execute(invocation.command, invocation.args, { ...options, cwd }, true)
}
