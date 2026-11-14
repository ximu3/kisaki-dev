/** @fileoverview Supplies the independent Node and browser installations of this public package. */

import { readFile, writeFile } from 'node:fs/promises'
import { test } from 'vite-plus/test'
import { join, resolve } from 'node:path'
import { installConsumer } from '@kisaki3/tooling/testing/consumer'

/** This package's root and completed distribution artifacts. */
const packageRoot = resolve(import.meta.dirname, '../..')

/** The checked tarballs belonging to this external consumer. */
const archives = {
  '@kisaki3/desktop-contracts': join(packageRoot, 'out/package/package.tgz'),
  '@kisaki3/desktop-appearance': join(packageRoot, '../desktop-appearance/out/package/package.tgz'),
  '@kisaki3/extension-distribution': join(
    packageRoot,
    '../extension-distribution/out/package/package.tgz',
  ),
}

/** Creates a file-scoped installation of the selected consumer project. */
export function consumerTest(host: 'node' | 'browser') {
  return test.extend('consumerDirectory', { scope: 'file' }, async ({}, { onCleanup }) => {
    const consumerDirectory = await installConsumer(
      join(import.meta.dirname, 'fixtures', host),
      archives,
      onCleanup,
    )
    // Include every published declaration through the same package resolution used by the consumer.
    const installed = JSON.parse(
      await readFile(
        join(consumerDirectory, 'node_modules/@kisaki3/desktop-contracts/package.json'),
        'utf8',
      ),
    ) as { name: string; exports: Record<string, unknown> }
    const imports = Object.keys(installed.exports).map(
      (subpath) => `import '${installed.name}${subpath.slice(1)}'`,
    )
    await writeFile(join(consumerDirectory, 'public-entries.d.ts'), imports.join('\n'))

    return consumerDirectory
  })
}
