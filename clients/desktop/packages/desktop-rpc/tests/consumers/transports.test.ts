/** @fileoverview Exercises the same package archive over Node JSON IPC and an actual Electron window port. */

import { join } from 'node:path'
import { createRequire } from 'node:module'
import { test } from 'vitest'
import { run } from '@kisaki3/tooling/process'
import { prepareConsumer } from '../support/consumer'

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
  const executable: unknown = createRequire(import.meta.url)('electron')
  if (typeof executable !== 'string') {
    throw new Error('Expected the installed Electron executable')
  }
  await run(executable, [directory, `--user-data-dir=${join(directory, 'profile')}`], {
    cwd: directory,
    signal,
  })
})
