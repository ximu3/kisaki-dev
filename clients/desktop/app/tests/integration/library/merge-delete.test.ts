import { loadNative } from '#native'
import { parseEntryMergeInput, type WorkRef } from '@kisaki3/desktop-contracts/library'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vite-plus/test'
import { prepareMergeLocations } from '../../../src/main/features/library/holdings/merge'
import { libraryStorage } from '../../../src/main/features/library/storage'
import { initializeDatabase } from '../../../src/main/infrastructure/database'
import type { DatabaseCall } from '../../../src/main/infrastructure/database/executor'
import { storageOptions } from '../database/sample'

test('merging works keeps target personal values, moves a part, linked note and history, and coalesces duplicate book registrations', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kisaki-work-identity-')),
    options = storageOptions(root)
  const storage = initializeDatabase(options),
    library = libraryStorage(storage)
  try {
    const src = library.createLibraryEntry(
      {
        type: 'novel',
        name: 'Source',
        originalName: '原名',
        evaluation: { rating: 90, favorite: true },
        record: { additionalCompletionCount: 5 },
        completionRecords: [{ note: 'Read', completedDate: null }],
      },
      [],
    ).value as WorkRef<'novel'>
    const dst = library.createLibraryEntry({ type: 'novel', name: 'Target' }, [])
      .value as WorkRef<'novel'>
    const part = library.addLibraryPart(
      { type: 'novelVolume', work: src, data: { numberLabel: '1' }, completed: true },
      [],
    ).value as { type: 'novelVolume'; id: string }
    const note = library.createNote({ title: 'Independent', entries: [src] }, []).value
    const path = join(root, 'one.txt')
    await writeFile(path, 'Original content')
    const facts = { kind: 'file', book: { format: 'txt', pageCount: null } } as const
    const original = library.registerFile(
      src,
      { path, associations: [{ part, isPreferred: true }] },
      facts,
      [],
      null,
    ).value.id
    const kept = library.registerFile(dst, { path, note: 'Keep' }, facts, [], null).value.id
    const activity = library.addActivity({
      work: src,
      startedAt: 1000,
      endedAt: 2000,
      durationMs: 800,
      context: { fileId: original, part },
    }).value
    const mark = library.createAnnotation(
      {
        workType: 'novel',
        novelId: src.id,
        target: {
          fileId: original,
          location: {
            type: 'position',
            position: {
              type: 'page',
              page: { type: 'pageIndex', index: 0 },
              point: { x: 0, y: 0 },
            },
          },
          quote: 'Original',
          imageId: null,
        },
      },
      [],
    ).value
    expect(
      library.listAnnotations(
        { scope: { type: 'work', work: src }, search: 'Original' },
        { limit: 10, offset: 0 },
        true,
      ).total,
    ).toBe(1)

    const input = parseEntryMergeInput({ sources: [src], target: dst })
    const call: DatabaseCall<typeof library> = async (name, ...args) =>
      Reflect.apply(library[name], library, args) as never
    const locations = await prepareMergeLocations(
      input,
      call,
      loadNative(options.collationExtension).files,
      root,
      new AbortController().signal,
    )
    library.mergeLibraryEntries(input, locations, library.entryDependencies([dst, src]))
    expect(library.readLibraryEntry(src, true)).toBeNull()
    expect(library.readLibraryEntry(dst, true)).toMatchObject({
      name: 'Target',
      originalName: '原名',
      evaluation: { favorite: false, rating: null },
      record: { additionalCompletionCount: 0 },
      completionCount: 1,
    })
    expect(library.readLibraryPart(part, true)).toMatchObject({ work: dst, completed: true })
    expect(library.readWorkFile(dst, kept, true)).toMatchObject({
      note: 'Keep',
      associations: [{ part, isPreferred: true }],
    })
    expect(library.readActivity(dst, activity, true)).toMatchObject({
      id: activity,
      context: { fileId: kept, part },
    })
    expect(library.getAnnotation({ workType: 'novel', id: mark }, true)).toMatchObject({
      novelId: dst.id,
      fileId: kept,
    })
    expect(library.listNoteEntries(note, { offset: 0, limit: 10 }, true).items).toEqual([dst])

    library.deleteLibraryEntries([dst], library.entryDependencies([dst]))
    expect(library.getNote(note)?.title).toBe('Independent')
    expect(library.listNoteEntries(note, { offset: 0, limit: 10 }, true).items).toEqual([])
    expect(await readFile(path, 'utf8')).toBe('Original content')
  } finally {
    storage.close()
    await rm(root, { recursive: true, force: true })
  }
})
