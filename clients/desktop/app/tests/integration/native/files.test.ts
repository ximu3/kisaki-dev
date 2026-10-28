/**
 * @fileoverview Exercises the shipped native loader, no-replace moves and file
 * synchronization against real filesystem outcomes.
 */

import { afterEach, beforeEach, expect, test } from 'vitest'
import { chmod, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadNative, NativeLoadError, FileMoveError, FileSyncError } from '#native'
import { appRoot, buildDirectory } from '../../../tools/lib/paths'
import { hostTarget } from '../../../tools/lib/targets'

const binding = join(buildDirectory(hostTarget()), 'resources', 'native', 'kisaki-native.node')
let directory: string

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'kisaki-native-'))
})
afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

test('preserves the native loading cause at the supplied module path', async () => {
  const path = join(directory, 'invalid.node')
  await writeFile(path, 'not a native module')
  let failure: unknown
  try {
    loadNative(path)
  } catch (cause) {
    failure = cause
  }

  expect(failure).toBeInstanceOf(NativeLoadError)
  expect(failure).toHaveProperty('cause', expect.any(Error))
})

test('moves files and directories without replacing existing targets', async () => {
  const { files } = loadNative(binding)
  const source = join(directory, '资料 🎮 source')
  const target = join(directory, 'target')
  await writeFile(source, 'new content')
  await writeFile(target, 'keep content')
  await expect(files.moveNoReplace(source, target)).rejects.toMatchObject({
    name: 'FileMoveError',
    reason: 'targetExists',
  })
  expect(await readFile(target, 'utf8')).toBe('keep content')
  await files.moveNoReplace(source, join(directory, 'moved'))
  expect(await readFile(join(directory, 'moved'), 'utf8')).toBe('new content')
  await mkdir(source)
  const existingDirectory = join(directory, 'existing-directory')
  await mkdir(existingDirectory)
  await expect(files.moveNoReplace(source, existingDirectory)).rejects.toMatchObject({
    reason: 'targetExists',
  })
  await files.moveNoReplace(source, join(directory, 'moved-directory'))
})

test('racing moves publish exactly one source and leave the other intact', async () => {
  const { files } = loadNative(binding)
  const first = join(directory, 'first')
  const second = join(directory, 'second')
  const target = join(directory, 'target')
  await writeFile(first, 'first')
  await writeFile(second, 'second')
  const results = await Promise.allSettled([
    files.moveNoReplace(first, target),
    files.moveNoReplace(second, target),
  ])
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
  const winner = await readFile(target, 'utf8')
  const remaining = winner === 'first' ? second : first
  expect(await readFile(remaining, 'utf8')).not.toBe(winner)
})

test('reports absent sources and rejects invalid paths before scheduling native work', async () => {
  const { files } = loadNative(binding)
  await expect(
    files.moveNoReplace(join(directory, 'missing'), join(directory, 'target')),
  ).rejects.toMatchObject({ reason: 'sourceMissing' })
  await writeFile(join(directory, 'source'), 'retained')
  const missingParent = files.moveNoReplace(
    join(directory, 'source'),
    join(directory, 'absent-parent', 'target'),
  )
  await expect(missingParent).rejects.toBeInstanceOf(FileMoveError)
  await expect(missingParent).rejects.toMatchObject({ reason: 'ioFailure' })
  await expect(files.moveNoReplace('relative', join(directory, 'target'))).rejects.toThrow(
    TypeError,
  )
})

test('a cross-volume move fails without copying or deleting the source', async (context) => {
  const other = await mkdtemp(join(appRoot, '.cache', 'cross-volume-'))
  try {
    if ((await stat(directory)).dev === (await stat(other)).dev) {
      context.skip('The test environment exposes only one filesystem for these temporary roots')
    }
    const { files } = loadNative(binding)
    const source = join(directory, 'source')
    await writeFile(source, 'retained')
    await expect(files.moveNoReplace(source, join(other, 'target'))).rejects.toMatchObject({
      reason: 'crossDevice',
    })
    expect(await readFile(source, 'utf8')).toBe('retained')
    await expect(stat(join(other, 'target'))).rejects.toMatchObject({ code: 'ENOENT' })
  } finally {
    await rm(other, { recursive: true, force: true })
  }
})

test('synchronizes existing regular files and reports missing or wrong-type paths', async () => {
  const { files } = loadNative(binding)
  const path = join(directory, 'file')
  await writeFile(path, '')
  await files.syncFile(path)
  await chmod(path, 0)
  try {
    await expect(files.syncFile(path)).rejects.toMatchObject({ reason: 'permissionDenied' })
  } finally {
    await chmod(path, 0o600)
  }
  await writeFile(path, 'content')
  await files.syncFile(path)
  await expect(files.syncFile(directory)).rejects.toMatchObject({ reason: 'wrongType' })
  await expect(files.syncFile(join(directory, 'missing'))).rejects.toMatchObject({
    reason: 'pathMissing',
  })
  await expect(files.syncFile('relative')).rejects.toBeInstanceOf(FileSyncError)
  // Windows rejects deleting an open file: cleanup also proves the worker released its handle.
  await rm(path)
})
