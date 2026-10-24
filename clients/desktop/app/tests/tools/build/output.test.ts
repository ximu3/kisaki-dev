import { afterEach, beforeEach, expect, test } from 'vitest'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { replaceOutput, requireChildPath } from '../../../tools/lib/output'

let directory: string
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'kisaki-output-'))
})
afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

test('failed preparation retains the prior output and releases the writer lock', async () => {
  const output = join(directory, 'program')
  await mkdir(output)
  await writeFile(join(output, 'entry.js'), 'previous bytes')

  await expect(
    replaceOutput(output, async (staging) => {
      await writeFile(join(staging, 'entry.js'), 'partial bytes')
      throw new Error('Synthetic compiler failure')
    }),
  ).rejects.toThrow('Synthetic compiler failure')

  expect(await readFile(join(output, 'entry.js'), 'utf8')).toBe('previous bytes')
  expect(await readdir(directory)).toEqual(['program'])

  await replaceOutput(output, async (staging) => {
    await writeFile(join(staging, 'renamed.js'), 'complete bytes')
  })
  expect(await readdir(output)).toEqual(['renamed.js'])
})

test('two concurrent builds cannot write the same published directory', async () => {
  let release!: () => void
  let entered!: () => void
  const started = new Promise<void>((resolve) => {
    entered = resolve
  })
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const output = join(directory, 'program')
  const first = replaceOutput(output, async () => {
    entered()
    await pending
  })
  await started
  try {
    await expect(replaceOutput(output, async () => undefined)).rejects.toMatchObject({
      code: 'EEXIST',
    })
  } finally {
    release()
    await first
  }
})

test('cleanup accepts only a strict child of the declared output owner', () => {
  expect(requireChildPath(directory, join(directory, 'out'))).toBe(join(directory, 'out'))
  expect(() => requireChildPath(directory, directory)).toThrow('outside')
  expect(() => requireChildPath(directory, join(directory, '..', 'other'))).toThrow('outside')
})
