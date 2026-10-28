/**
 * @fileoverview Creates a persistent parent and leaf process for command-tree cancellation
 * tests.
 */

import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const [directory, role] = process.argv.slice(2)
if (!directory) throw new Error('The fixture directory is required')

// Both fixture processes remain alive until the command cancellation ends their process tree.
if (role === 'leaf') {
  process.send?.({ ready: true })
  setInterval(() => undefined, 1_000)
} else {
  const child = spawn(
    process.execPath,
    [...process.execArgv, fileURLToPath(import.meta.url), directory, 'leaf'],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] },
  )

  await new Promise<void>((resolve, reject) => {
    child.once('error', reject)
    child.once('message', () => resolve())
  })
  if (!child.pid) throw new Error('Fixture child process is unavailable')

  await writeFile(
    join(directory, 'tree.json'),
    JSON.stringify({ parent: process.pid, leaf: child.pid }),
  )
}
