/**
 * @fileoverview Runs finite commands and pnpm tasks with cancellation, optional output
 * capture and structured failures.
 */

import { spawn } from 'node:child_process'
import type { SpawnOptions } from 'node:child_process'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stopProcessGroup } from './unix.ts'

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
  readonly stdout: string
  readonly stderr: string

  /**
   * Records a positive exit code and any captured output; missing or nonpositive codes become 1.
   */
  constructor(
    command: string,
    code: number | null,
    signal: string | null,
    stdout = '',
    stderr = '',
  ) {
    super(`Tool failed: ${basename(command)} (${signal ?? code})`)
    this.exitCode = code && code > 0 ? code : 1
    this.stdout = stdout
    this.stderr = stderr
  }
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

  const windows = process.platform === 'win32'
  const stdio = capture ? 'pipe' : 'inherit'
  const launch: SpawnOptions = {
    windowsHide: true,
    ...(options.cwd ? { cwd: options.cwd } : {}),
    ...(options.env ? { env: options.env } : {}),
    detached: !windows,
    stdio: windows ? ['ignore', stdio, stdio, 'ipc'] : ['ignore', stdio, stdio],
  }
  const child = windows
    ? spawn(
        process.execPath,
        [fileURLToPath(new URL('./windows.ts', import.meta.url)), command, ...args],
        launch,
      )
    : spawn(command, args, launch)

  let failure: unknown
  let stopping: Promise<void> | undefined
  let stdout = ''
  let stderr = ''
  let size = 0

  /** Starts one termination request and retains any failure while the child closes. */
  const cancel = () => {
    if (windows) {
      // Ending the job owner closes the kernel's last job handle, including all inherited writers.
      child.kill('SIGKILL')
      return
    }
    if (!child.pid) {
      return
    }
    stopping ??= stopProcessGroup(child.pid).catch((cause: unknown) => {
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
