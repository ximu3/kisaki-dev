/** @fileoverview Copies selected font files and notices from the workspace's locked dependencies. */

import { createRequire } from 'node:module'
import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { appRoot } from '../lib/paths'

const requireDependency = createRequire(join(appRoot, 'package.json'))

/** Files selected from a font dependency pinned by the workspace lockfile. */
export interface FontInput {
  package: string
  files: string[]
}

/**
 * Copies selected font files and notices from locked dependencies into the target font directory.
 *
 * The resource workflow owns the output directory; the final build inventories its runtime bytes.
 */
export async function copyFonts(fontInputs: FontInput[], output: string): Promise<void> {
  for (const font of fontInputs) {
    const directory = dirname(requireDependency.resolve(`${font.package}/package.json`))
    const destination = join(output, font.package.split('/').at(-1)!)
    for (const path of font.files) {
      await mkdir(dirname(join(destination, path)), { recursive: true })
      await copyFile(join(directory, path), join(destination, path))
    }
  }
}
