import { loadNative } from '#native'
import { parseLibraryWriteGraph } from '@kisaki3/desktop-contracts/library'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vite-plus/test'
import { createDirectoryRegistration } from '../../../../src/main/features/library/holdings/directories/register'
import { createGameRegistration } from '../../../../src/main/features/library/holdings/game/launch-configs/register'
import { prepareRegistrations } from '../../../../src/main/features/library/write-graph/local-content'
import { graphIds, references } from '../../../../src/main/features/library/write-graph/references'
import { windowErrors } from '../../../../src/shared/window-api/protocol'
import { storageOptions } from '../../database/sample'

test('an unavailable game launch target keeps its file error at the window boundary', async () => {
  const absent = join(tmpdir(), 'kisaki-missing-' + randomUUID(), 'game.exe')
  const native = loadNative(storageOptions(tmpdir()).collationExtension).files
  const register = createGameRegistration(
    async () => {
      throw new Error('Unexpected database operation')
    },
    (commit) => commit.value,
    native,
  )
  const outcome = register({ type: 'game', id: 'sample' }, absent, new AbortController().signal)
  await expect(
    outcome.catch((error: unknown) => windowErrors.encode(error, 'library.holdings.register')),
  ).resolves.toMatchObject({ code: 'FileUnavailable' })
})

test('ordinary and graph registrations report the same missing directory at the window boundary', async () => {
  const path = join(tmpdir(), 'kisaki-missing-' + randomUUID()).replaceAll('\\', '/')
  const signal = new AbortController().signal
  const native = loadNative(storageOptions(tmpdir()).collationExtension).files
  const call = async () => {
    throw new Error('Unexpected database operation')
  }
  const register = createDirectoryRegistration(
    call,
    (result) => result.value,
    native,
    () => {},
  )
  const graph = parseLibraryWriteGraph({
    entries: { create: [{ key: 'book', type: 'novel', name: 'Book' }] },
    localContent: { novel: [{ work: { key: 'book' }, directories: [{ path }] }] },
  })
  const refs = references(graphIds(graph), new Map())
  const encode = (cause: unknown) => windowErrors.encode(cause, 'library.writeGraph')
  await expect(
    register({ type: 'novel', id: 'book' }, { path }, signal).catch(encode),
  ).resolves.toMatchObject({ code: 'FileUnavailable' })
  await expect(
    prepareRegistrations(graph.localContent, refs, call, native, '', signal).catch(encode),
  ).resolves.toMatchObject({ code: 'FileUnavailable' })
})
