import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  isWorkType,
  type EntryCreate,
  type EntryRef,
  type EntryUpdate,
  type Evaluation,
  type ExternalIdentity,
} from '@kisaki3/desktop-contracts/library'
import { eq, getTableColumns } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import {
  entries,
  entryDescriptionAttachments,
  entryEvaluations,
} from '../../../infrastructure/database/schema'
import { checkImages, imageIds, inlineImages } from '../attachments'
import { editEntryCollections } from '../organizers/collections/memberships'
import { editEntryTags } from '../organizers/tags/applications'
import { addCompletion } from '../records/completions/write'
import { expectFields, type LibraryWrite } from '../transaction'
import { bindIdentity, readIdentities, unbindIdentity } from './external-ids'
import { readWorkRecord, saveWorkRecord } from './personal'
import { readEvaluation } from './query/details'
import { catalogTables, entryWhere } from './tables'

function valuesFor(columns: object, values: object) {
  return Object.fromEntries(
    Object.entries<unknown>({ ...values }).filter(([key]) => Object.hasOwn(columns, key)),
  )
}

function setDescriptionImages(write: LibraryWrite, id: string, description: string | null) {
  const { db } = write
  const previous = db
    .delete(entryDescriptionAttachments)
    .where(eq(entryDescriptionAttachments.ownerId, id))
    .returning({ id: entryDescriptionAttachments.attachmentId })
    .all()
  const ids = new Set(inlineImages(description))
  for (const row of previous) {
    if (!ids.has(row.id)) {
      write.released.add(row.id)
    }
  }
  for (const attachmentId of ids) {
    db.insert(entryDescriptionAttachments).values({ ownerId: id, attachmentId }).run()
  }
}

function replaceIdentities(
  write: LibraryWrite,
  entry: EntryRef,
  next: readonly ExternalIdentity[],
) {
  const current = readIdentities(write.db, entry.id)
  const key = (value: ExternalIdentity) => JSON.stringify([value.source, value.sourceId])
  const keep = new Set(next.map(key))
  const saved = new Set(current.map(key))
  for (const identity of current) {
    if (!keep.has(key(identity))) {
      unbindIdentity(write.db, entry.id, identity)
    }
  }
  for (const identity of next) {
    if (!saved.has(key(identity))) {
      bindIdentity(write.db, entry.id, identity)
    }
  }
  return !isDeepStrictEqual(keep, saved)
}

function saveEvaluation(
  write: LibraryWrite,
  entry: EntryRef,
  changes: Partial<Evaluation>,
  expected?: Partial<Evaluation>,
) {
  const before = readEvaluation(write.db, entry.id)
  expectFields(before, expected)
  const after = { ...before, ...changes }
  if (isDeepStrictEqual(before, after)) {
    return
  }
  write.db
    .insert(entryEvaluations)
    .values({ entryId: entry.id, ...after })
    .onConflictDoUpdate({ target: entryEvaluations.entryId, set: after })
    .run()
  write.changes.push({ type: 'evaluationChanged', entry })
}

export function createEntry(write: LibraryWrite, input: EntryCreate, id: string = randomUUID()) {
  const { db, now } = write
  const ref = { id, type: input.type }
  const specific = catalogTables[input.type]
  checkImages(db, imageIds(input))
  db.insert(entries)
    .values({
      ...valuesFor(getTableColumns(entries), input),
      ...ref,
      name: input.name,
      createdAt: now,
      updatedAt: now,
    })
    .run()
  db.insert(specific)
    .values({ entryId: ref.id, ...valuesFor(getTableColumns(specific), input) })
    .run()
  write.changes.push({ type: 'entryCreated', entry: ref })
  if (input.description) {
    setDescriptionImages(write, ref.id, input.description)
  }
  for (const identity of input.externalIdentities ?? []) {
    bindIdentity(db, ref.id, identity)
  }
  if (input.evaluation) {
    saveEvaluation(write, ref, input.evaluation)
  }

  if ('record' in input || 'completionRecords' in input) {
    const work = { type: input.type, id: ref.id }
    for (const row of input.completionRecords ?? []) {
      addCompletion(write, work, row)
    }
    if (input.record || input.completionRecords?.length) {
      saveWorkRecord(db, work, { ...readWorkRecord(db, work), ...input.record })
      write.changes.push({ type: 'workRecordChanged', work })
    }
  }
  if (input.tags) {
    editEntryTags(write, ref, { type: 'replace', items: input.tags })
  }
  if (input.collections) {
    editEntryCollections(write, ref, { type: 'replace', items: input.collections })
  }
  return ref
}

export function updateEntry(write: LibraryWrite, input: EntryUpdate) {
  const { db, now } = write
  const { ref, changes, expected } = input
  const base = db.select().from(entries).where(entryWhere(ref)).get()
  if (!base) {
    throw new DesktopError('NotFound', 'The entry does not exist')
  }
  const table = catalogTables[ref.type]
  const specific = db.select().from(table).where(eq(table.entryId, ref.id)).get()
  if (!specific) {
    throw new DesktopError('DataIntegrityError', 'The entry is missing its type data')
  }
  const before = { ...base, ...specific }

  const common = valuesFor(getTableColumns(entries), changes)
  const extra = valuesFor(getTableColumns(table), changes)
  expectFields(before, {
    ...valuesFor(getTableColumns(entries), expected ?? {}),
    ...valuesFor(getTableColumns(table), expected ?? {}),
  })
  for (const fields of [common, extra]) {
    for (const [key, value] of Object.entries(fields)) {
      if (isDeepStrictEqual(value, Reflect.get(before, key))) {
        delete fields[key]
      }
    }
  }

  if (expected?.externalIdentities) {
    const set = (items: readonly ExternalIdentity[]) =>
      new Set(items.map((x) => JSON.stringify([x.source, x.sourceId])))
    if (!isDeepStrictEqual(set(expected.externalIdentities), set(readIdentities(db, ref.id)))) {
      throw new DesktopError('Conflict', 'The external identities changed')
    }
  }
  const rebound =
    changes.externalIdentities && replaceIdentities(write, ref, changes.externalIdentities)
  if (Object.keys(common).length || Object.keys(extra).length || rebound) {
    checkImages(db, imageIds(changes))
    for (const key of ['primaryImageId', 'backdropImageId', 'titleLogoId', 'iconImageId']) {
      if (Object.hasOwn(common, key) || Object.hasOwn(extra, key)) {
        const old: unknown = Reflect.get(before, key)
        if (typeof old === 'string') {
          write.released.add(old)
        }
      }
    }
    if ('description' in common) {
      setDescriptionImages(write, ref.id, changes.description ?? null)
    }
    db.update(entries)
      .set({ ...common, updatedAt: now })
      .where(eq(entries.id, ref.id))
      .run()
    if (Object.keys(extra).length) {
      db.update(table).set(extra).where(eq(table.entryId, ref.id)).run()
    }
    write.changes.push({ type: 'entryUpdated', entry: ref })
  }
  if (changes.evaluation) {
    saveEvaluation(write, ref, changes.evaluation, expected?.evaluation)
  }
  if (changes.record && isWorkType(ref.type)) {
    const work = { type: ref.type, id: ref.id }
    const record = readWorkRecord(db, work)
    expectFields(record, expected?.record)
    const next = { ...record, ...changes.record }
    if (!isDeepStrictEqual(next, record)) {
      saveWorkRecord(db, work, next)
      write.changes.push({ type: 'workRecordChanged', work })
    }
  }
  if (changes.tags) {
    editEntryTags(write, ref, changes.tags, expected?.tags)
  }
  if (changes.collections) {
    editEntryCollections(write, ref, changes.collections, expected?.collections)
  }
}
