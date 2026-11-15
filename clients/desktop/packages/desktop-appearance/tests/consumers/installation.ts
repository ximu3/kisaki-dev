/** @fileoverview Supplies the independent Node and browser installations of this public package. */

import { test } from 'vite-plus/test'
import { join, resolve } from 'node:path'
import { installConsumer } from '@kisaki3/tooling/testing/consumer'

/** This package's root for the independent tarball installation. */
const packageRoot = resolve(import.meta.dirname, '../..')

/** Creates a file-scoped installation of the selected consumer project. */
export function consumerTest(host: 'node' | 'browser') {
  return test.extend('consumerDirectory', { scope: 'file' }, async ({}, { onCleanup }) => {
    return installConsumer(join(import.meta.dirname, 'fixtures', host), packageRoot, onCleanup)
  })
}
