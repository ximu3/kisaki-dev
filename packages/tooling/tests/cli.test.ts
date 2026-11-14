/** @fileoverview Ensures cancellation cannot conceal a real cleanup failure. */

import { expect, test } from 'vite-plus/test'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

test.each([
  ['cancel', 130, ''],
  ['cleanup', 1, 'Synthetic cleanup failure'],
] as const)('%s reports its actual outcome after CLI cleanup', async (mode, code, diagnostic) => {
  const child = spawn(process.execPath, [resolve('tests/support/cli-worker.ts'), mode], {
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  let stderr = ''
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
    stderr += chunk
  })
  const result = await new Promise<number | null>((resolveClose, reject) => {
    child.once('error', reject)
    child.once('close', resolveClose)
  })

  expect(result).toBe(code)
  if (diagnostic) {
    expect(stderr).toContain(diagnostic)
  } else {
    expect(stderr).toBe('')
  }
})
