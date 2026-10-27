import { afterEach, beforeEach, expect, test } from 'vitest'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { replaceOutput } from '@kisaki3/tooling/output'

let directory: string
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'kisaki-output-'))
})
afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

test('failed preparation retains prior output and a successful retry removes old files', async () => {
  const output = join(directory, 'program')
  await mkdir(output)
  await writeFile(join(output, 'entry.js'), 'previous bytes')

  await expect(
    replaceOutput(directory, output, async (staging) => {
      await writeFile(join(staging, 'entry.js'), 'partial bytes')
      throw new Error('Synthetic compiler failure')
    }),
  ).rejects.toThrow('Synthetic compiler failure')
  expect(await readFile(join(output, 'entry.js'), 'utf8')).toBe('previous bytes')
  expect(await readdir(join(directory, '.cache', 'output-staging'))).toEqual([])

  await replaceOutput(directory, output, async (staging) => {
    await writeFile(join(staging, 'renamed.js'), 'complete bytes')
  })
  expect(await readdir(output)).toEqual(['renamed.js'])
})

test('cancellation after preparation preserves prior output and removes the unused candidate', async () => {
  const output = join(directory, 'program')
  const controller = new AbortController()
  await mkdir(output)
  await writeFile(join(output, 'entry.js'), 'previous bytes')

  await expect(
    replaceOutput(
      directory,
      output,
      async (staging) => {
        await writeFile(join(staging, 'entry.js'), 'cancelled bytes')
        controller.abort()
      },
      controller.signal,
    ),
  ).rejects.toMatchObject({ name: 'AbortError' })
  expect(await readFile(join(output, 'entry.js'), 'utf8')).toBe('previous bytes')
  expect(await readdir(join(directory, '.cache', 'output-staging'))).toEqual([])
})

test('candidate replacement rejects the project itself and destinations outside its owner', async () => {
  for (const output of [directory, join(directory, '..', 'other')]) {
    await expect(replaceOutput(directory, output, async () => undefined)).rejects.toThrow('outside')
  }
})
