/** @fileoverview Verifies NodeNext declarations and actual packed pure values in a standalone Node consumer. */

import { lintConsumer } from '@kisaki3/tooling/testing/consumer'
import { expect } from 'vite-plus/test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { runPnpm } from '@kisaki3/tooling/process'
import { consumerTest } from './consumer'

/** Isolated Node consumer fixtures that install and exercise the actual contracts tarball. */
const test = consumerTest('node')

test('Node globals alone support the complete public type graph and actual value consumption', async ({
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
    date: { year: 2004 },
    entryType: 'game',
    metadataType: 'anime',
    locale: 'zh-Hans-CN',
    link: 'kisaki://view/anime/external/bangumi/subject%2F123',
    theme: 'builtin',
    protocol: 1,
    icon: { type: 'lucide', name: 'book-open' },
  })
})
