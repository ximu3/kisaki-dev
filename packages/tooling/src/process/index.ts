import { spawn } from 'node:child_process'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stopProcessGroup } from './unix.ts'

export interface ProcessOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  signal?: AbortSignal | undefined
}

export class CommandFailed extends Error {
  readonly exitCode: number

  constructor(command: string, code: number | null, signal: string | null) {
    super(`Tool failed: ${basename(command)} (${signal ?? code})`)
    this.exitCode = code && code > 0 ? code : 1
  }
}

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

function pnpmExecutable(): string {
  const executable = process.env.npm_execpath
  if (!executable) {
    throw new Error('Run this workflow with pnpm exec vp run')
  }
  return executable
}

export async function runPnpm(args: string[], options: ProcessOptions = {}): Promise<void> {
  await run(pnpmExecutable(), args, options)
}
