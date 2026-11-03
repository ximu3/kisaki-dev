/** @fileoverview Verifies NodeNext declarations and actual packed pure values in a standalone Node consumer. */

import { expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { runPnpm } from '@kisaki3/tooling/process'
import { consumerTest, lintConsumer } from '../support/consumer'

const test = consumerTest('node')

test('Node globals alone support the complete public type graph and actual ICU/value consumption', async ({
  consumerDirectory,
  signal,
}) => {
  await runPnpm(['typecheck'], { cwd: consumerDirectory, signal })
  await runPnpm(['build'], { cwd: consumerDirectory, signal })
  expect((await lintConsumer(consumerDirectory)).flatMap((item) => item.messages)).toEqual([])

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
    order: -1,
    metadataType: 'anime',
    message: '2 items selected',
    link: 'kisaki://view/anime/external/bangumi/subject%2F123',
    themeFont: 'default',
    protocol: 1,
  })
  expect(
    await readFile(
      join(consumerDirectory, 'node_modules/@kisaki3/desktop-contracts/NOTICE'),
      'utf8',
    ),
  ).toContain('UNICODE LICENSE V3')
})
