import { loadNative } from '#native'
import {
  parseLibraryWriteGraph,
  parseLibraryWriteResult,
  type WorkRef,
} from '@kisaki3/desktop-contracts/library'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vite-plus/test'
import { entryTagsInOrder } from '../../../src/main/features/library/organizers/tags/applications'
import { libraryStorage } from '../../../src/main/features/library/storage'
import { prepareRegistrations } from '../../../src/main/features/library/write-graph/local-content'
import { graphIds, references } from '../../../src/main/features/library/write-graph/references'
import { initializeDatabase } from '../../../src/main/infrastructure/database'
import type { DatabaseCall } from '../../../src/main/infrastructure/database/executor'
import { storageOptions } from '../database/sample'

test('changing cast endpoints requires explicit migration or removal of each existing credit, preserving the cast and credit IDs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kisaki-graph-')),
    opts = storageOptions(root)
  const storage = initializeDatabase(opts),
    library = libraryStorage(storage)
  const run = (raw: unknown) => {
    const graph = parseLibraryWriteGraph(raw)
    return library.writeLibraryGraph(graph, graphIds(graph), [], []).value
  }
  try {
    const nodes = run({
      entries: {
        create: [
          { key: 'show', type: 'anime', name: 'Winter' },
          { key: 'actor', type: 'person', name: 'Actor' },
          { key: 'old', type: 'character', name: 'Snow' },
          { key: 'new', type: 'character', name: 'Rain' },
        ],
      },
      relations: {
        personWorks: {
          add: [
            {
              work: { key: 'show' },
              person: { key: 'actor' },
              character: { key: 'old' },
              role: 'voiceActor',
              note: 'Original cast',
            },
          ],
        },
      },
    })
    const scope = { side: 'work' as const, entry: nodes.entries.show! },
      range = { offset: 0, limit: 10 }
    const cast = library.listFacts({ ...scope, kind: 'workCharacter' }, range, true, true).items[0]!
    const credit = library.listFacts({ ...scope, kind: 'personWork' }, range, true, true).items[0]!
    const change = { id: cast.id, changes: { character: nodes.entries.new! } }
    expect(() =>
      run({
        entries: { update: [{ ref: nodes.entries.show, changes: { name: 'Should roll back' } }] },
        relations: { workCharacters: { update: [change] } },
      }),
    ).toThrow(/explicitly/u)
    expect(library.readLibraryEntry(nodes.entries.show!, true)?.name).toBe('Winter')
    expect(library.readVisibleFact('personWork', credit.id, true, true)).toMatchObject({
      character: nodes.entries.old,
      note: 'Original cast',
    })

    expect(
      run({
        relations: {
          workCharacters: { update: [change] },
          personWorks: { update: [{ id: credit.id, changes: { character: nodes.entries.new } }] },
        },
      }).changed,
    ).toBe(true)
    expect(library.readVisibleFact('workCharacter', cast.id, true, true)).toMatchObject({
      character: nodes.entries.new,
    })
    expect(library.readVisibleFact('personWork', credit.id, true, true)).toMatchObject({
      character: nodes.entries.new,
      note: 'Original cast',
    })
    expect(
      run({
        relations: {
          workCharacters: { update: [{ id: cast.id, changes: { character: nodes.entries.old } }] },
          personWorks: { remove: [credit.id] },
        },
      }).changed,
    ).toBe(true)
    expect(library.readVisibleFact('personWork', credit.id, true, true)).toBeNull()
    expect(run({}).changed).toBe(false)
  } finally {
    storage.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('registers a real book and its preferred volume in the same graph as the work, volume and tag', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kisaki-book-graph-')),
    opts = storageOptions(root),
    native = loadNative(opts.collationExtension).files
  const storage = initializeDatabase(opts),
    library = libraryStorage(storage)
  try {
    const path = join(root, 'book.txt')
    await writeFile(path, 'The first volume')
    const graph = parseLibraryWriteGraph({
      tags: { create: [{ key: 'tag', name: 'Winter' }] },
      entries: {
        create: [{ key: 'work', type: 'novel', name: 'Coast', tags: [{ tagId: { key: 'tag' } }] }],
      },
      parts: {
        create: [
          {
            key: 'volume',
            work: { key: 'work' },
            type: 'novelVolume',
            data: { numberLabel: '01' },
            completed: true,
          },
        ],
      },
      localContent: {
        novel: [
          {
            work: { key: 'work' },
            directories: [{ path: root }],
            files: [{ path, associations: [{ part: { key: 'volume' }, isPreferred: true }] }],
          },
        ],
      },
    })
    const ids = graphIds(graph),
      call: DatabaseCall<typeof library> = async (name, ...args) =>
        Reflect.apply(library[name], library, args) as never
    const content = await prepareRegistrations(
      graph.localContent,
      references(ids, new Map()),
      call,
      native,
      root,
      new AbortController().signal,
    )
    const saved = library.writeLibraryGraph(graph, ids, [], content).value
    expect(parseLibraryWriteResult(saved, graph)).toEqual(saved)
    const work = saved.entries.work! as WorkRef<'novel'>
    expect(library.readLibraryPart(saved.parts.volume!, true)?.completed).toBe(true)
    expect(entryTagsInOrder(storage.db, work.id)).toMatchObject([{ tagId: saved.tags.tag }])
    const file = library.libraryPositions(work).find((row) => row.path === path)!
    expect(library.readWorkFile(work, file.id, true)).toMatchObject({
      path,
      associationMode: 'manual',
      associations: [{ part: saved.parts.volume, isPreferred: true }],
    })
  } finally {
    storage.close()
    await rm(root, { recursive: true, force: true })
  }
})
