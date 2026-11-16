/** @fileoverview Exercises the same package archive over Node JSON IPC and an actual Electron window port. */

import { join, resolve } from 'node:path'
import { onTestFinished, test } from 'vite-plus/test'
import { run, runPnpm } from '@kisaki3/tooling/process'
import { installConsumer, lintConsumer } from '@kisaki3/tooling/testing/consumer'

/** This package's root and completed distribution artifacts. */
const packageRoot = resolve(import.meta.dirname, '../..')

/** Installs and compiles the selected transport fixture; its test owns child-process closure. */
async function prepareConsumer(host: 'node' | 'electron', signal: AbortSignal): Promise<string> {
  const directory = await installConsumer(
    join(import.meta.dirname, 'fixtures', host),
    packageRoot,
    onTestFinished,
    signal,
  )
  await runPnpm(['build'], { cwd: directory, signal })
  await lintConsumer(directory, signal)
  return directory
}

test('parent and child exchange nested calls, cancellation, errors and release on IPC loss', async ({
  signal,
}) => {
  const directory = await prepareConsumer('node', signal)
  await run(process.execPath, [join(directory, '.cache/node/parent.js')], {
    cwd: directory,
    signal,
  })
})

test('sandboxed window and main exchange structured clones and release waits on window destruction', async ({
  signal,
}) => {
  const directory = await prepareConsumer('electron', signal)
  await runPnpm(['exec', 'electron', '.', `--user-data-dir=${join(directory, 'profile')}`], {
    cwd: directory,
    signal,
  })
})
