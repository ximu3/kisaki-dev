import { createConsumerTest, lintConsumer } from '@kisaki3/tooling/testing/consumer'
import { expect, test as base } from 'vite-plus/test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { runPnpm } from '@kisaki3/tooling/process'

const test = createConsumerTest(base, join(import.meta.dirname, '../..'), 'node')

test('NodeNext declarations and pure entrypoints work without browser dependencies', async ({
  consumerDirectory,
  signal,
}) => {
  await runPnpm(['build'], { cwd: consumerDirectory, signal })
  await lintConsumer(consumerDirectory, signal)

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
    kind: 'color',
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
