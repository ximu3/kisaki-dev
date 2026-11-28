import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vite-plus/test'
import {
  parseEntryCreate,
  parseEntryQuery,
  parseEntryUpdate,
  parseShowcaseFields,
} from '@kisaki3/desktop-contracts/library'
import { initializeDatabase, type Storage } from '../../../src/main/infrastructure/database'
import { libraryStorage } from '../../../src/main/features/library/storage'
import { storageOptions } from '../database/sample'

let root: string
let storage: Storage
let library: ReturnType<typeof libraryStorage>
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'kisaki-catalog-'))
  storage = initializeDatabase(storageOptions(root))
  library = libraryStorage(storage)
})
afterEach(async () => {
  storage?.close()
  await rm(root, { recursive: true, force: true })
})

test('a failed identity assignment rolls back the earlier entry edit in the batch', () => {
  const identity = { source: 'example', sourceId: '42' }
  const novel = library.createLibraryEntry(
    parseEntryCreate({ type: 'novel', name: 'Evening', externalIdentities: [identity] }),
    [],
  ).value
  const person = library.createLibraryEntry(
    parseEntryCreate({ type: 'person', name: 'Writer' }),
    [],
  ).value
  expect(() =>
    library.editLibraryEntries(
      [
        parseEntryUpdate({
          ref: novel,
          changes: { name: 'Morning' },
          expected: { name: 'Evening' },
        }),
        parseEntryUpdate({ ref: person, changes: { externalIdentities: [identity] } }),
      ],
      [],
    ),
  ).toThrow()
  expect(library.readLibraryEntry(novel, true)).toMatchObject({
    name: 'Evening',
    externalIdentities: [identity],
  })
  expect(library.findLibraryIdentity(identity, true)).toEqual(novel)
})

test('manual and dynamic scopes, record counts and locate agree on the committed entries', () => {
  const work = library.createLibraryEntry(
    parseEntryCreate({
      type: 'anime',
      name: 'Ｗｉｎｔｅｒ',
      description: '**Sea**',
      record: { status: 'active' },
    }),
    [],
  ).value
  if (work.type !== 'anime') {
    throw new Error('Unexpected work type')
  }
  const anime = { type: work.type, id: work.id }
  const input = {
    work: anime,
    completedDate: { year: 2024, month: 12, day: 3 },
    note: null,
    expected: { completionCount: 0 },
  }
  expect(library.recordCompletions([input, input], true).value).toHaveLength(1)
  expect(() => library.recordCompletions([input], false)).toThrow()
  expect(library.readLibraryEntry(anime, true)).toMatchObject({
    completionCount: 1,
    record: { status: null },
  })
  const query = parseEntryQuery({
    scope: { type: 'library' },
    search: 'winter sea',
    sort: { type: 'scope' },
    rules: [{ enabled: true, types: ['anime'], filter: { match: 'all', conditions: [] } }],
  })
  const collection = library.addLibraryCollection(
    {
      name: 'Winter',
      membershipMode: 'dynamic',
      dynamicRules: {
        rules: query.rules,
        search: query.search,
        sort: { type: 'field', field: 'effectiveSortName', direction: 'asc' },
        referenceLabels: [],
      },
    },
    [],
    false,
  ).value
  const view = { sensitive: false, spoilers: false }
  expect(
    library.readEntryInterval(
      { ...query, scope: { type: 'unclassified' } },
      { offset: 0, limit: 10 },
      view,
    ),
  ).toEqual({ total: 0, items: [] })
  expect(
    library.locateLibraryEntry(
      query,
      anime,
      { limit: 10, group: { type: 'collection', id: collection }, fields: ['completionCount'] },
      view,
    ),
  ).toMatchObject({ total: 1, index: 0, items: [{ id: anime.id, completionCount: 1 }] })
})

test('saving a showcase fills the referenced name and independent edits compare only changed fields', () => {
  const collection = library.addLibraryCollection({ name: 'Shelf' }, [], true).value
  const fields = parseShowcaseFields({
    name: 'Next',
    query: {
      kind: 'entry',
      scope: { type: 'collection', id: collection },
      search: '',
      rules: [],
      sort: { type: 'scope' },
      referenceLabels: [],
    },
    layout: 'horizontal',
    itemSize: 'md',
    limit: 12,
    openMode: 'page',
    isVisible: true,
  })
  const section = library.addSections([fields], true).value[0]!
  expect(section.query).toMatchObject({
    status: 'ready',
    value: { referenceLabels: [{ target: { type: 'collection', id: collection }, name: 'Shelf' }] },
  })
  library.editSection(section.id, { changes: { name: 'Spring' }, expected: { name: 'Next' } }, true)
  expect(() =>
    library.editSection(
      section.id,
      { changes: { name: 'Autumn' }, expected: { name: 'Next' } },
      true,
    ),
  ).toThrow()
  expect(
    library.editSection(
      section.id,
      { changes: { isVisible: false }, expected: { isVisible: true } },
      true,
    ).value,
  ).toMatchObject({ name: 'Spring', isVisible: false })
})
