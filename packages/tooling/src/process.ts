/**
 * @fileoverview Runs finite commands and pnpm tasks with cancellation, optional output
 * capture and structured failures.
 */

import { execFile, spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { basename } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'

/** Working directory, environment and cancellation for one finite child command. */
export interface ProcessOptions {
  /** Child working directory; omission inherits the current process directory. */
  cwd?: string
  /** Complete child environment; omission inherits process.env as in Node's spawn(). */
  env?: NodeJS.ProcessEnv
  /** Requests cancellation; command completion still waits for child stream closure. */
  signal?: AbortSignal | undefined
}

/** A failed child command's exit status and captured diagnostics. */
export class CommandFailed extends Error {
  readonly exitCode: number

  /**
   * Records a positive exit code and any captured output; missing or nonpositive codes become 1.
   */
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

/**
 * Sends a Unix process-group signal, or probes the group when the signal is zero.
 *
 * Returns false for a missing group or a Darwin group with no live members. Other signal failures
 * reject the operation.
 */
async function signalGroup(group: number, signal: NodeJS.Signals | 0): Promise<boolean> {
  try {
    process.kill(-group, signal)
    return true
  } catch (cause) {
    const code = (cause as NodeJS.ErrnoException).code
    if (code === 'ESRCH') {
      return false
    }
    if (process.platform === 'darwin' && code === 'EPERM') {
      // Darwin excludes zombies from group signals and can return EPERM while their group is reaped.
      const { stdout } = await promisify(execFile)('/bin/ps', ['-axo', 'pgid=,stat='])
      const live = stdout
        .trim()
        .split('\n')
        .some((line) => {
          const [pgid, state] = line.trim().split(/\s+/)
          return Number(pgid) === group && !state?.startsWith('Z')
        })
      if (!live) {
        return false
      }
    }

    throw cause
  }
}

/**
 * Requests termination of a running child command and its process tree.
 *
 * Windows awaits taskkill. Unix allows five seconds after SIGTERM before sending SIGKILL. The
 * caller separately waits for the child's close event.
 */
async function stopCommand(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) {
    return
  }

  if (process.platform === 'win32') {
    try {
      await promisify(execFile)('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        windowsHide: true,
      })
    } catch (cause) {
      if (child.exitCode === null && child.signalCode === null) {
        throw cause
      }
    }

    return
  }

  if (!(await signalGroup(child.pid, 'SIGTERM'))) {
    return
  }

  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    if (!(await signalGroup(child.pid, 0))) {
      return
    }

    await delay(50)
  }

  // The owned group gets five seconds to stop normally before forced termination.
  await signalGroup(child.pid, 'SIGKILL')
}

/**
 * Runs a command until its streams close and pending termination handling settles.
 *
 * Capture uses one shared 1 MiB budget for stdout and stderr; overflow requests cancellation.
 * Nonzero exits reject with CommandFailed. Startup and termination failures are reported after
 * child closure.
 */
async function execute(
  command: string,
  args: string[],
  options: ProcessOptions,
  capture: boolean,
): Promise<string> {
  const limit = new AbortController()
  const signals = [limit.signal]
  if (options.signal) {
    signals.push(options.signal)
  }
  const signal = AbortSignal.any(signals)
  signal.throwIfAborted()

  const child = spawn(command, args, {
    windowsHide: true,
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

  /** Starts one termination request and retains any failure while the child closes. */
  const cancel = () => {
    stopping ??= stopCommand(child).catch((cause: unknown) => {
      failure = cause
      // Keep output ownership until closure, but report a failed termination request immediately.
      console.error(
        `Could not terminate ${basename(command)} (${child.pid}); waiting for closure`,
        cause,
      )
    })
  }

  signal.addEventListener('abort', cancel, { once: true })
  if (signal.aborted) {
    cancel()
  }
  child.once('error', (cause) => {
    failure = cause
  })

  /** Appends a captured chunk, requesting cancellation when the shared 1 MiB limit is exceeded. */
  function collect(value: string, error: boolean): void {
    size += Buffer.byteLength(value)
    if (size > 1024 * 1024) {
      limit.abort(new Error('Captured tool output exceeds 1 MiB'))
      return
    }

    if (error) {
      stderr += value
    } else {
      stdout += value
    }
  }

  child.stdout?.setEncoding('utf8').on('data', (value: string) => collect(value, false))
  child.stderr?.setEncoding('utf8').on('data', (value: string) => collect(value, true))

  try {
    const result = await new Promise<{ code: number | null; signal: string | null }>((resolve) => {
      child.once('close', (code, exitSignal) => resolve({ code, signal: exitSignal }))
    })
    await stopping

    if (failure) {
      throw failure
    }
    signal.throwIfAborted()
    if (result.code !== 0) {
      throw new CommandFailed(command, result.code, result.signal, stdout, stderr)
    }

    return stdout
  } finally {
    signal.removeEventListener('abort', cancel)
  }
}

/**
 * Runs a finite command with inherited standard output and error.
 *
 * Settles after child streams close and cancellation handling ends. Startup, termination and
 * nonzero-exit failures reject the operation.
 */
export async function run(
  command: string,
  args: string[],
  options: ProcessOptions = {},
): Promise<void> {
  await execute(command, args, options, false)
}

/** Resolves the pnpm executable that launched the current project task. */
function pnpmCommand(args: string[]): { command: string; args: string[] } {
  const executable = process.env.npm_execpath
  if (!executable) {
    throw new Error('Run this workflow through its pnpm project task')
  }

  return executable.endsWith('.exe')
    ? { command: executable, args }
    : { command: process.execPath, args: [executable, ...args] }
}

/** Runs a pnpm task with inherited diagnostics and waits for child closure. */
export async function runPnpm(args: string[], options: ProcessOptions = {}): Promise<void> {
  const invocation = pnpmCommand(args)
  await run(invocation.command, invocation.args, options)
}

/**
 * Runs pnpm in the supplied directory and returns its captured standard output.
 *
 * Stdout and stderr share a 1 MiB limit. The explicit directory takes precedence over options.cwd;
 * completion and failure follow {@link run}.
 */
export async function readPnpm(
  args: string[],
  cwd: string,
  options: ProcessOptions = {},
): Promise<string> {
  const invocation = pnpmCommand(args)
  return execute(invocation.command, invocation.args, { ...options, cwd }, true)
}
