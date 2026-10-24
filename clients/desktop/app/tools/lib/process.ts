import { execFile, spawn } from 'node:child_process'
import type { SpawnOptions } from 'node:child_process'
import { promisify } from 'node:util'

/** Run a process and resolve after a zero exit and closed output streams. */
export async function run(
  command: string,
  args: string[],
  options: SpawnOptions = {},
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', windowsHide: true, ...options })
    child.once('error', reject)
    child.once('close', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`Tool failed: ${command} (${signal ?? code})`))
    })
  })
}

/** Invoke the same pnpm executable that started the project task. */
export async function runPnpm(args: string[], options: SpawnOptions = {}): Promise<void> {
  const executable = process.env.npm_execpath
  if (!executable) throw new Error('Run this workflow through its pnpm project task')

  if (executable.endsWith('.exe')) await run(executable, args, options)
  else await run(process.execPath, [executable, ...args], options)
}

/** Run pnpm in cwd and return standard output, with a 1 MiB capture limit. */
export async function readPnpm(args: string[], cwd: string): Promise<string> {
  const executable = process.env.npm_execpath
  if (!executable) throw new Error('Run this workflow through its pnpm project task')

  const command = executable.endsWith('.exe') ? executable : process.execPath
  const commandArgs = executable.endsWith('.exe') ? args : [executable, ...args]
  const result = await promisify(execFile)(command, commandArgs, {
    cwd,
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  })

  return result.stdout
}
