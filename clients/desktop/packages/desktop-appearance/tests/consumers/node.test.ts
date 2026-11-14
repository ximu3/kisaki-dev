/** @fileoverview Exercises the packed pure entrypoints in an independent Node-only consumer. */

import { lintConsumer } from '@kisaki3/tooling/testing/consumer'
import { expect } from 'vite-plus/test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { runPnpm } from '@kisaki3/tooling/process'
import { consumerTest } from './consumer'

/** Isolated Node fixtures that install and exercise the actual appearance tarball. */
const test = consumerTest('node')

test('NodeNext declarations and pure entrypoints work without browser dependencies', async ({
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

  expect(JSON.parse(stdout)).toMatchObject({
    count: 43,
    radius: '6px',
  })

  expect(
    await readFile(
      join(consumerDirectory, 'node_modules/@kisaki3/desktop-appearance/LICENSE'),
      'utf8',
    ),
  ).toContain('MIT License')

  const notices = await readFile(
    join(
      consumerDirectory,
      'node_modules/@kisaki3/desktop-appearance/dist/THIRD-PARTY-NOTICES.txt',
    ),
    'utf8',
  )
  for (const notice of [
    'css-tree',
    'mdn-data',
    'source-map-js',
    'CC0 1.0 Universal',
    'Mozilla Foundation',
  ]) {
    expect(notices).toContain(notice)
  }
})
