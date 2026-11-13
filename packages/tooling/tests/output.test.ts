/** @fileoverview Checks that destructive output cleanup stays inside its owning project. */

import { expect, onTestFinished, test } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { removeOutputs } from '@kisaki3/tooling/output'

test('output cleanup removes declared directories and refuses the project or its parent', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kisaki-output-'))
  onTestFinished(() => rm(directory, { recursive: true, force: true }))
  await mkdir(join(directory, 'dist'))
  await writeFile(join(directory, 'dist/entry.js'), 'reproducible')
  await writeFile(join(directory, 'retained.txt'), 'retained input')

  for (const output of ['.', '..']) {
    await expect(removeOutputs(directory, [output])).rejects.toThrow('outside')
  }
  await removeOutputs(directory, ['dist'])

  await expect(readFile(join(directory, 'dist/entry.js'))).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await readFile(join(directory, 'retained.txt'), 'utf8')).toBe('retained input')
})
