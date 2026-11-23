import { join } from 'node:path'
import { createConsumerTest, lintConsumer } from '@kisaki3/tooling/testing/consumer'
import { expect, test as base } from 'vite-plus/test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { runPnpm } from '@kisaki3/tooling/process'

const test = createConsumerTest(base, join(import.meta.dirname, '../..'), 'node')

test('Node globals alone support the complete public type graph and actual localization consumption', async ({
  consumerDirectory,
  signal,
}) => {
  await runPnpm(['build'], { cwd: consumerDirectory, signal })

  await lintConsumer(consumerDirectory, signal)

  const { stdout } = await promisify(execFile)(
    process.env.KISAKI_CONSUMER_NODE ?? process.execPath,
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
