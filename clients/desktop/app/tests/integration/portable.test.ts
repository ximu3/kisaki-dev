import { afterEach, beforeEach, expect, test } from 'vitest'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { portableDataDirectory } from '../../src/main/app/portable'

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'kisaki-portable-'))
})
afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

test('an absent marker leaves existing portable data untouched', async () => {
  await writeFile(join(directory, 'data'), 'retained data')

  expect(portableDataDirectory(directory, 'data')).toBeUndefined()
  expect(await readFile(join(directory, 'data'), 'utf8')).toBe('retained data')
})

test('a regular marker selects the prepared portable directory', async () => {
  await writeFile(join(directory, 'kisaki-portable.txt'), '')
  await mkdir(join(directory, 'data'))

  expect(portableDataDirectory(directory, 'data')).toBe(join(directory, 'data'))
})

test('a marker directory is rejected', async () => {
  await mkdir(join(directory, 'kisaki-portable.txt'))

  expect(() => portableDataDirectory(directory, 'data')).toThrow('regular file')
})

test('a marker with missing data fails without creating a replacement directory', async () => {
  await writeFile(join(directory, 'kisaki-portable.txt'), '')

  expect(() => portableDataDirectory(directory, 'data')).toThrow()
  expect(await readdir(directory)).toEqual(['kisaki-portable.txt'])
})
