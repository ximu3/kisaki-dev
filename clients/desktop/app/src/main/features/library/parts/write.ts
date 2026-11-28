import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  partWorkType,
  type ExternalIdentity,
  type PartCreate,
  type PartDetails,
  type PartRef,
  type PartUpdate,
} from '@kisaki3/desktop-contracts/library'
import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { checkImages, imageIds, inlineImages } from '../attachments'
import { requireEntry } from '../entries/tables'
import { expectFields, type LibraryDatabase, type LibraryWrite } from '../transaction'
import { insertAnimePart } from './anime/write'
import { insertComicPart } from './comic/write'
import { newPartRow } from './creation'
import { insertNovelPart } from './novel'
import { parts } from './tables'

export function getPart(db: LibraryDatabase, ref: PartRef): PartDetails | null {
  const { table, identities, record, ownerKey } = parts[ref.type]
  const row = db.select().from(table).where(eq(table.id, ref.id)).get()
  if (!row) {
    return null
  }
  const externalIdentities = db
    .select({ source: identities.source, sourceId: identities.sourceId })
    .from(identities)
    .where(eq(identities.ownerId, ref.id))
    .orderBy(identities.source, identities.sourceId)
    .all()
  const personal = db
    .select({ completed: record.isCompleted })
    .from(record)
    .where(eq(record.partId, ref.id))
    .get()
  const data = { ...row }
  for (const key of ['id', 'createdAt', 'updatedAt', 'sortOrder', ownerKey]) {
    Reflect.deleteProperty(data, key)
  }
  return {
    ref,
    work: { type: partWorkType(ref.type), id: Reflect.get(row, ownerKey) as string },
    data: { ...data, externalIdentities },
    completed: personal?.completed ?? false,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  } as PartDetails
}

export function requirePart(db: LibraryDatabase, ref: PartRef) {
  const row = getPart(db, ref)
  if (!row) {
    throw new DesktopError('InvalidReference', 'The part no longer exists')
  }
  return row
}

function identitiesFor(write: LibraryWrite, ref: PartRef, values: readonly ExternalIdentity[]) {
  const table = parts[ref.type].identities
  const known = write.db.select().from(table).where(eq(table.ownerId, ref.id)).all()
  for (const old of known) {
    if (!values.some((value) => value.source === old.source && value.sourceId === old.sourceId)) {
      write.db
        .delete(table)
        .where(and(eq(table.source, old.source), eq(table.sourceId, old.sourceId)))
        .run()
    }
  }
  for (const value of values) {
    const owner = write.db
      .select({ id: table.ownerId })
      .from(table)
      .where(and(eq(table.source, value.source), eq(table.sourceId, value.sourceId)))
      .get()
    if (owner) {
      if (owner.id !== ref.id) {
        throw new DesktopError('Conflict', 'The external identity belongs to another part')
      }
    } else {
      write.db
        .insert(table)
        .values({ ...value, ownerId: ref.id })
        .run()
    }
  }
}

function markdownImages(write: LibraryWrite, ref: PartRef, text: string | null) {
  const table = parts[ref.type].images
  const taken = new Set(inlineImages(text))
  const removed = write.db
    .delete(table)
    .where(eq(table.ownerId, ref.id))
    .returning({ id: table.attachmentId })
    .all()
  for (const row of removed) {
    if (!taken.has(row.id)) {
      write.released.add(row.id)
    }
  }
  for (const id of taken) {
    write.db.insert(table).values({ ownerId: ref.id, attachmentId: id }).run()
  }
}

export function completePart(write: LibraryWrite, ref: PartRef, completed: boolean) {
  const part = requirePart(write.db, ref)
  if (part.completed === completed) {
    return
  }
  const record = parts[ref.type].record
  write.db
    .insert(record)
    .values({ partId: ref.id, isCompleted: completed })
    .onConflictDoUpdate({ target: record.partId, set: { isCompleted: completed } })
    .run()
  write.changes.push({ type: 'partRecordChanged', part: ref, work: part.work } as Extract<
    LibraryWrite['changes'][number],
    { type: 'partCreated' | 'partUpdated' | 'partDeleted' | 'partRecordChanged' }
  >)
}

export function insertPart(
  write: LibraryWrite,
  input: PartCreate,
  id: string = randomUUID(),
  createdAt = write.now,
) {
  requireEntry(write.db, input.work)
  checkImages(write.db, imageIds(input.data))
  const ref = { type: input.type, id }
  const schema = parts[input.type]
  const common = newPartRow(write, schema, input.work.id, id, createdAt)
  switch (input.type) {
    case 'animeEpisode':
    case 'animeExtra':
      insertAnimePart(write.db, input, common)
      break
    case 'comicChapter':
    case 'comicVolume':
      insertComicPart(write.db, input, common)
      break
    case 'novelVolume':
      insertNovelPart(write.db, input, common)
      break
  }
  if (input.data.externalIdentities) {
    identitiesFor(write, ref, input.data.externalIdentities)
  }
  if (input.data.description) {
    markdownImages(write, ref, input.data.description)
  }
  write.changes.push({ type: 'partCreated', part: ref, work: input.work } as Extract<
    LibraryWrite['changes'][number],
    { type: 'partCreated' | 'partUpdated' | 'partDeleted' | 'partRecordChanged' }
  >)
  if (input.completed) {
    completePart(write, ref, true)
  }
  return ref
}

export function changePart(write: LibraryWrite, input: PartUpdate) {
  const current = requirePart(write.db, input.ref)
  const { db } = write
  const { ref, expected, changes } = input
  if (expected?.externalIdentities) {
    const ids = (list: readonly ExternalIdentity[]) =>
      new Set(list.map((row) => JSON.stringify([row.source, row.sourceId])))
    if (
      !isDeepStrictEqual(ids(expected.externalIdentities), ids(current.data.externalIdentities))
    ) {
      throw new DesktopError('Conflict', 'Part identities have changed')
    }
  }
  const prior = { ...expected }
  Reflect.deleteProperty(prior, 'externalIdentities')
  expectFields(current.data, prior)
  const changed: Record<string, unknown> = Object.fromEntries(
    Object.entries(changes).filter(
      ([key, value]) => !isDeepStrictEqual(Reflect.get(current.data, key), value),
    ),
  )
  if (!Object.keys(changed).length) {
    return
  }
  checkImages(db, imageIds(changes))
  if (changes.externalIdentities) {
    identitiesFor(write, ref, changes.externalIdentities)
  }
  if ('description' in changed) {
    markdownImages(write, ref, changes.description ?? null)
  }
  if ('primaryImageId' in changed && current.data.primaryImageId) {
    write.released.add(current.data.primaryImageId)
  }
  delete changed.externalIdentities
  const table = parts[ref.type].table
  db.update(table)
    .set({ ...changed, updatedAt: write.now })
    .where(eq(table.id, ref.id))
    .run()
  write.changes.push({ type: 'partUpdated', work: current.work, part: ref } as Extract<
    LibraryWrite['changes'][number],
    { type: 'partCreated' | 'partUpdated' | 'partDeleted' | 'partRecordChanged' }
  >)
}
