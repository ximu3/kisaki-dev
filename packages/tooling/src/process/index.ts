/**
 * @fileoverview Runs finite commands and pnpm tasks with inherited diagnostics and cancellation.
 */

import { spawn } from 'node:child_process'
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

/** A failed child command's exit status. */
export class CommandFailed extends Error {
  readonly exitCode: number

  /** Preserves a positive child exit status, using 1 for signal or startup failure. */
  constructor(command: string, code: number | null, signal: string | null) {
    super(`Tool failed: ${basename(command)} (${signal ?? code})`)
    this.exitCode = code && code > 0 ? code : 1
  }
}

/**
 * Runs a finite command with inherited diagnostics, waiting for closure and owned termination.
 * Startup failures and nonzero exit statuses reject the operation.
 */
export async function run(
  command: string,
  args: string[],
  options: ProcessOptions = {},
): Promise<void> {
  const { signal } = options
  signal?.throwIfAborted()

  const windows = process.platform === 'win32'
  const launch = {
    windowsHide: true,
    ...(options.cwd ? { cwd: options.cwd } : {}),
    ...(options.env ? { env: options.env } : {}),
    detached: !windows,
  }
  const child = windows
    ? spawn(
        process.execPath,
        [fileURLToPath(new URL('./windows.ts', import.meta.url)), command, ...args],
        { ...launch, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] },
      )
    : spawn(command, args, { ...launch, stdio: ['ignore', 'inherit', 'inherit'] })

  let failure: unknown
  let stopping: Promise<void> | undefined

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

  signal?.addEventListener('abort', cancel, { once: true })
  if (signal?.aborted) {
    cancel()
  }
  child.once('error', (cause) => {
    failure = cause
  })

  try {
    const result = await new Promise<{ code: number | null; signal: string | null }>((resolve) => {
      child.once('close', (code, exitSignal) => resolve({ code, signal: exitSignal }))
    })
    await stopping

    if (failure) {
      throw failure
    }
    signal?.throwIfAborted()
    if (result.code !== 0) {
      throw new CommandFailed(command, result.code, result.signal)
    }
  } finally {
    signal?.removeEventListener('abort', cancel)
  }
}

/** Resolves the pnpm executable that launched the current project task. */
function pnpmExecutable(): string {
  const executable = process.env.npm_execpath
  if (!executable) {
    throw new Error('Run this workflow through its pnpm project task')
  }
  return executable
}

/** Runs a pnpm task with inherited diagnostics and waits for child closure. */
export async function runPnpm(args: string[], options: ProcessOptions = {}): Promise<void> {
  await run(pnpmExecutable(), args, options)
}
