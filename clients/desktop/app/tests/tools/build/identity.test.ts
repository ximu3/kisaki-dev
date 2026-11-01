/** @fileoverview Checks that runtime inventories cover bytes and exclude their own manifest. */

import { expect, test } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runtimeFiles } from '../../../tools/build/identity'

test('runtime inventories follow file content without hashing their own manifest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kisaki-runtime-files-'))
  try {
    await mkdir(join(root, 'main'))
    await writeFile(join(root, 'main/entry.js'), 'first runtime')
    await writeFile(join(root, 'build.json'), '{}')
    const before = await runtimeFiles(root)

    await writeFile(join(root, 'main/entry.js'), 'second runtime')
    const after = await runtimeFiles(root)
    expect(Object.keys(after)).toEqual(['main/entry.js'])
    expect(after['main/entry.js']).not.toBe(before['main/entry.js'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
