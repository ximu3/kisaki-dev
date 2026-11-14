/** @fileoverview Supplies the independent Node and browser installations of this public package. */

import { test } from 'vite-plus/test'
import { join, resolve } from 'node:path'
import { installConsumer } from '@kisaki3/tooling/testing/consumer'

/** This package's root and completed distribution artifacts. */
const packageRoot = resolve(import.meta.dirname, '../..')

/** The checked tarballs belonging to this external consumer. */
const archives = {
  '@kisaki3/extension-distribution': join(packageRoot, 'out/package/package.tgz'),
}

/** Creates a file-scoped installation of the selected consumer project. */
export function consumerTest(host: 'node' | 'browser') {
  return test.extend('consumerDirectory', { scope: 'file' }, async ({}, { onCleanup }) => {
    const consumerDirectory = await installConsumer(
      join(import.meta.dirname, 'fixtures', host),
      archives,
      onCleanup,
    )
    return consumerDirectory
  })
}
