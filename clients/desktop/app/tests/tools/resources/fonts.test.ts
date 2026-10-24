import { afterEach, beforeEach, expect, test } from 'vitest'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { copyFonts } from '../../../tools/resources/fonts'
import type { FontInput } from '../../../tools/resources/fonts'
import { appRoot } from '../../../tools/lib/paths'
import { sha256 } from '../../../tools/lib/sha256'

let directory: string
let input: FontInput

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'kisaki-fonts-'))
  const inputs: FontInput[] = JSON.parse(
    await readFile(join(appRoot, 'assets/fonts/inputs.json'), 'utf8'),
  )
  const font = inputs[0]!
  input = {
    ...font,
    files: { 'index.css': font.files['index.css']!, LICENSE: font.files.LICENSE! },
  }
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

test('copies the locked stylesheet and license from the installed font package', async () => {
  await copyFonts([input], directory)

  const output = join(directory, input.package.split('/').at(-1)!)
  expect((await readdir(output)).sort()).toEqual(['LICENSE', 'index.css'])
  for (const [name, digest] of Object.entries(input.files)) {
    expect(sha256(await readFile(join(output, name)))).toBe(digest)
  }
})

test('rejects a different font package version before writing files', async () => {
  await expect(copyFonts([{ ...input, version: '0.0.0' }], directory)).rejects.toThrow(
    'version mismatch',
  )
  expect(await readdir(directory)).toEqual([])
})

test('rejects content that does not match the pinned digest', async () => {
  const corrupted = { ...input, files: { 'index.css': '0'.repeat(64) } }

  await expect(copyFonts([corrupted], directory)).rejects.toThrow('checksum mismatch')
  expect(await readdir(directory)).toEqual([])
})
