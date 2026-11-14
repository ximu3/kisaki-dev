/** @fileoverview Builds the isolated Node and Electron consumers of the packed RPC library. */

import { onTestFinished } from 'vite-plus/test'
import { runPnpm } from '@kisaki3/tooling/process'
import { lintConsumer } from '@kisaki3/tooling/testing/consumer'
import { join, resolve } from 'node:path'
import { installConsumer } from '@kisaki3/tooling/testing/consumer'

/** This package's root and completed distribution artifacts. */
const packageRoot = resolve(import.meta.dirname, '../..')

/** The checked tarballs belonging to this external consumer. */
const archives = {
  '@kisaki3/desktop-rpc': join(packageRoot, 'out/package/package.tgz'),
}

/** Installs and compiles the selected transport fixture; its test owns child-process closure. */
export async function prepareConsumer(
  host: 'node' | 'electron',
  signal: AbortSignal,
): Promise<string> {
  const directory = await installConsumer(
    join(import.meta.dirname, 'fixtures', host),
    archives,
    onTestFinished,
    signal,
  )
  await runPnpm(['build'], { cwd: directory, signal })
  await lintConsumer(directory, signal)
  return directory
}
