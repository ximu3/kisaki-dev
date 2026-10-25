import { afterEach, beforeEach, expect, test } from 'vitest'
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { replaceOutput, withOutputs } from '../../../../../../tools/outputs'

let directory: string
beforeEach(async () => {
  directory = await realpath(await mkdtemp(join(tmpdir(), 'kisaki-output-')))
})
afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

test('failed preparation retains the prior output and releases the writer lock', async () => {
  const output = join(directory, 'program')
  await mkdir(output)
  await writeFile(join(output, 'entry.js'), 'previous bytes')

  await expect(
    replaceOutput(
      directory,
      output,
      async (staging) => {
        await writeFile(join(staging, 'entry.js'), 'partial bytes')
        throw new Error('Synthetic compiler failure')
      },
      { root: directory },
    ),
  ).rejects.toThrow('Synthetic compiler failure')

  expect(await readFile(join(output, 'entry.js'), 'utf8')).toBe('previous bytes')
  expect(await readdir(join(directory, '.cache', 'output-staging'))).toEqual([])

  await replaceOutput(
    directory,
    output,
    async (staging) => {
      await writeFile(join(staging, 'renamed.js'), 'complete bytes')
    },
    { root: directory },
  )
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
  const first = replaceOutput(
    directory,
    output,
    async () => {
      entered()
      await pending
    },
    { root: directory },
  )
  await started
  try {
    await expect(
      replaceOutput(directory, output, async () => undefined, { root: directory }),
    ).rejects.toMatchObject({
      code: 'OUTPUT_IN_USE',
    })
  } finally {
    release()
    await first
  }
})

test('output access rejects the project itself and paths outside its owner', async () => {
  for (const output of [directory, join(directory, '..', 'other')]) {
    await expect(
      withOutputs([{ project: directory, mode: 'use', write: [output] }], async () => undefined, {
        root: directory,
      }),
    ).rejects.toThrow('outside')
  }
})
