/** @fileoverview Verifies NodeNext declarations and actual packed pure values in a standalone Node consumer. */

import { expect } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { runPnpm } from '@kisaki3/tooling/process'
import { consumerTest, lintConsumer } from '../support/consumer'

const test = consumerTest('node')

test('Node globals alone support the complete public type graph and actual localization consumption', async ({
  consumerDirectory,
  signal,
}) => {
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
    english: '2 items selected',
    translated: '保存',
    fallback: '2 items selected',
    literal: '<b>{literal}</b>',
    locale: 'zh-Hans-CN',
  })
})
