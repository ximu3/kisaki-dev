/** @fileoverview Checks bounded file and archive work against real handles, native publication and filesystem identities. */

import { afterEach, beforeEach, expect, test } from 'vite-plus/test'
import { createHash } from 'node:crypto'
import { link, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { loadNative } from '#native'
import {
  assertLocalDataDirectory,
  comparePaths,
  createArchive,
  readArchive,
  publishStoredFile,
  stageFile,
} from '../../../src/main/infrastructure/files'
import type { ArchiveLimits } from '../../../src/main/infrastructure/files'
import { appRoot } from '../../../tools/lib/paths'
import { hostTarget } from '../../../tools/lib/targets'

/** File primitives loaded from the prepared binding for the actual host target. */
const native = loadNative(join(appRoot, 'out/native', hostTarget(), 'kisaki-native.node')).files

/** Fixed archive budgets that keep these filesystem integration cases bounded. */
const limits: ArchiveLimits = {
  entries: 10,
  namesBytes: 1024,
  entryBytes: 1024 * 1024,
  totalBytes: 2 * 1024 * 1024,
  archiveBytes: 2 * 1024 * 1024,
}

/** Disposable filesystem root removed after the current case releases its streams. */
let directory: string

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'kisaki-files-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

test('publishes durable bytes once and cleans only its own preparation on limits or cancellation', async () => {
  const temporary = join(directory, 'temporary')
  const root = join(directory, 'attachments')
  const source = Buffer.from('資料 🎮')
  const prepared = await stageFile(temporary, Readable.from([source]), native, source.length)
  expect(prepared.sha256).toBe(createHash('sha256').update(source).digest('hex'))
  const target = await publishStoredFile(root, 'opaque/identity', prepared, native)
  await prepared.dispose()
  expect(await readFile(target)).toEqual(source)

  const second = await stageFile(temporary, Readable.from(['replacement']), native, 64)
  await expect(publishStoredFile(root, 'opaque/identity', second, native)).rejects.toMatchObject({
    reason: 'targetExists',
  })
  await second.dispose()
  expect(await readFile(target)).toEqual(source)

  await expect(stageFile(temporary, Readable.from([source]), native, 1)).rejects.toMatchObject({
    code: 'ResourceLimit',
  })
  const controller = new AbortController()
  const stream = Readable.from(
    (async function* () {
      yield source
      controller.abort()
      yield source
    })(),
  )
  await expect(stageFile(temporary, stream, native, 1024, controller.signal)).rejects.toThrow()
  expect(stream.destroyed).toBe(true)
  expect(await readdir(temporary)).toEqual([])
})

test('uses actual filesystem identities for links, containment, case and unavailable locations', async () => {
  await assertLocalDataDirectory(directory, native)
  const child = join(directory, 'Child')
  await mkdir(child)
  const alias = join(directory, 'alias')
  await symlink(child, alias, process.platform === 'win32' ? 'junction' : 'dir')
  expect(await comparePaths(child, alias)).toBe('same')
  expect(await comparePaths(directory, alias)).toBe('contains')
  expect(await comparePaths(child, directory)).toBe('within')
  expect(await comparePaths(child, join(directory, 'unavailable'))).toBe('unknown')

  const file = join(child, 'Case.txt')
  const hardLink = join(child, 'hard-link')
  await writeFile(file, 'same bytes')
  await link(file, hardLink)
  expect(await comparePaths(file, hardLink)).toBe('same')
  let caseSensitive = true
  try {
    await writeFile(join(child, 'case.txt'), 'another file', { flag: 'wx' })
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') {
      throw error
    }
    caseSensitive = false
  }
  expect(await comparePaths(file, join(child, 'case.txt'))).toBe(
    caseSensitive ? 'separate' : 'same',
  )
})

test('round trips Unicode names, empty directories and empty files and rejects corrupted CRC', async () => {
  const archive = await createArchive(
    directory,
    [
      { type: 'directory', path: '空目錄' },
      { type: 'file', path: '資料/é.txt', byteSize: 6, data: Readable.from([Buffer.from('資料')]) },
      { type: 'file', path: 'empty', byteSize: 0, data: Readable.from([]) },
    ],
    native,
    limits,
  )
  const values: { path: string; content: string }[] = []
  await readArchive(archive.path, limits, async (member, stream) => {
    const chunks: Buffer[] = []
    if (stream) {
      for await (const chunk of stream) {
        chunks.push(chunk as Buffer)
      }
    }
    values.push({ path: member.path, content: Buffer.concat(chunks).toString('utf8') })
  })
  expect(values).toEqual([
    { path: '空目錄', content: '' },
    { path: '資料/é.txt', content: '資料' },
    { path: 'empty', content: '' },
  ])

  const bytes = await readFile(archive.path)
  const central = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]))
  bytes[central + 16] = bytes[central + 16]! ^ 1
  await writeFile(archive.path, bytes)
  await expect(
    readArchive(archive.path, limits, async (_member, stream) => {
      if (stream) {
        for await (const chunk of stream) {
          expect(Buffer.isBuffer(chunk)).toBe(true)
        }
      }
    }),
  ).rejects.toThrow()
  await archive.dispose()
  expect(await readdir(directory)).toEqual([])
})

test('rejects archive path conflicts and wrong lengths and releases cancelled compression streams', async () => {
  await expect(
    createArchive(
      directory,
      [{ type: 'file', path: '../escape', byteSize: 1, data: Readable.from(['x']) }],
      native,
      limits,
    ),
  ).rejects.toMatchObject({ code: 'DataIntegrityError' })
  await expect(
    createArchive(
      directory,
      [
        { type: 'file', path: 'a', byteSize: 0, data: Readable.from([]) },
        { type: 'file', path: 'a/child', byteSize: 0, data: Readable.from([]) },
      ],
      native,
      limits,
    ),
  ).rejects.toMatchObject({ code: 'DataIntegrityError' })
  await expect(
    createArchive(
      directory,
      [{ type: 'file', path: 'a', byteSize: 1, data: Readable.from(['too many']) }],
      native,
      limits,
    ),
  ).rejects.toThrow()

  const controller = new AbortController()
  const source = Readable.from(
    (async function* () {
      yield Buffer.alloc(64 * 1024, 1)
      controller.abort()
      yield Buffer.alloc(64 * 1024, 2)
    })(),
  )
  await expect(
    createArchive(
      directory,
      [{ type: 'file', path: 'a', byteSize: 128 * 1024, data: source }],
      native,
      limits,
      controller.signal,
    ),
  ).rejects.toThrow()
  expect(source.destroyed).toBe(true)
  expect(await readdir(directory)).toEqual([])
})
