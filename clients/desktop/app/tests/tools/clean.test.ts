/**
 * @fileoverview Verifies that desktop cleanup removes declared outputs while retaining
 * profiles and caches.
 */

import { expect, test, vi } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { cleanOutputs } from '../../tools/clean'

const paths = vi.hoisted(() => ({ appRoot: '' }))
// Relocate the output owner so cleanup never touches a running development workspace.
vi.mock('../../tools/lib/paths', () => paths)

test('clean removes declared outputs and preserves development profiles and caches', async () => {
  paths.appRoot = await mkdtemp(join(tmpdir(), 'kisaki-clean-'))
  try {
    for (const directory of ['out', 'dist', '.local/development', '.cache']) {
      await mkdir(join(paths.appRoot, directory), { recursive: true })
      await writeFile(join(paths.appRoot, directory, 'retained.txt'), directory)
    }

    await cleanOutputs()

    for (const directory of ['out', 'dist']) {
      await expect(stat(join(paths.appRoot, directory))).rejects.toMatchObject({ code: 'ENOENT' })
    }

    for (const directory of ['.local/development', '.cache']) {
      expect(await readFile(join(paths.appRoot, directory, 'retained.txt'), 'utf8')).toBe(directory)
    }
  } finally {
    await rm(paths.appRoot, { recursive: true, force: true })
  }
})
