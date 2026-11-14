/** @fileoverview Verifies packed Node declarations and cryptographic behavior outside the monorepo. */

import { lintConsumer } from '@kisaki3/tooling/testing/consumer'
import { expect } from 'vite-plus/test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { runPnpm } from '@kisaki3/tooling/process'
import { consumerTest } from './consumer'

/** Isolated Node consumer fixtures for the actual distribution tarball. */
const test = consumerTest('node')

test('NodeNext declarations and signing execute from the installed tarball', async ({
  consumerDirectory,
  signal,
}) => {
  await runPnpm(['build'], { cwd: consumerDirectory, signal })
  await lintConsumer(consumerDirectory)

  const { stdout } = await promisify(execFile)(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      "import { summary } from './.cache/node/consumer.js'; console.log(JSON.stringify(summary));",
    ],
    { cwd: consumerDirectory, windowsHide: true, signal },
  )

  expect(JSON.parse(stdout)).toEqual({
    id: 'example',
    fingerprintLength: 64,
    entry: 'entry.js',
    tamperCode: 'invalid-signature',
  })

  expect(
    await readFile(
      join(consumerDirectory, 'node_modules/@kisaki3/extension-distribution/LICENSE'),
      'utf8',
    ),
  ).toContain('MIT License')
})
