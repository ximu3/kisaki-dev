/** @fileoverview Runs one finite command inside a dedicated Windows kernel job. */

import { spawn } from 'node:child_process'
import { Job } from '@seydx/win-job'

/**
 * Joins the job before spawning any command. Normal exit, forced exit and a lost parent all
 * release its descendants. The native handle stays open until this launcher exits.
 */
async function launch(command: string, args: string[]): Promise<number> {
  const job = new Job()
  job.assign(process.pid)

  /** Ends the entire job when the command's owning process disappears. */
  const disconnected = () => job.terminate(1)
  process.once('disconnect', disconnected)
  try {
    const child = spawn(command, args, { windowsHide: true, stdio: 'inherit' })
    return await new Promise<number>((resolve, reject) => {
      child.once('error', reject)
      child.once('close', (code) => resolve(code ?? 1))
    })
  } finally {
    process.off('disconnect', disconnected)
    if (process.connected) {
      process.disconnect()
    }
  }
}

if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2)
  if (!command || !process.connected) {
    throw new Error('Expected an owned command and parent channel')
  }
  process.exitCode = await launch(command, args)
}
