/** @fileoverview Checks that selected font files and notices reach the prepared resource set. */

import { expect, test } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { copyFonts } from '../../../tools/resources/fonts'
import { appRoot } from '../../../tools/lib/paths'

test('copies the selected stylesheet and license without changing their bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kisaki-fonts-'))
  const name = '@fontsource-variable/noto-sans-sc'
  const source = dirname(
    createRequire(join(appRoot, 'package.json')).resolve(`${name}/package.json`),
  )
  try {
    await copyFonts([{ package: name, files: ['index.css', 'LICENSE'] }], directory)
    const output = join(directory, 'noto-sans-sc')
    expect((await readdir(output)).sort()).toEqual(['LICENSE', 'index.css'])
    for (const file of ['index.css', 'LICENSE']) {
      expect(await readFile(join(output, file))).toEqual(await readFile(join(source, file)))
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
