import { isDeepStrictEqual } from 'node:util'
import { and, eq, max, sql } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parsePartCreate,
  parsePartUpdate,
  type PartRef,
  type PartKindChange,
  type PartDetails,
} from '@kisaki3/desktop-contracts/library'
import { comicVolumeChapters as chapters } from '../../../infrastructure/database/schema'
import { expectFields, type LibraryWrite, type LibraryDatabase } from '../transaction'
import { parts } from './tables'
import { getPart, requirePart, changePart, completePart, insertPart } from './write'

export function partDependents(db: LibraryDatabase, refs: readonly PartRef[]) {
  return refs.map((ref) => {
    const part = getPart(db, ref)
    if (!part) {
      throw new DesktopError('NotFound', 'The selected part no longer exists')
    }
    const links = parts[ref.type].files
    const files = db
      .select({ id: links.fileId })
      .from(links)
      .where(eq(links.partId, ref.id))
      .orderBy(links.fileId)
      .all()
      .map((row) => row.id)
    return { ref, work: part.work, files }
  })
}
export type PartDependents = ReturnType<typeof partDependents>
export function verifyDependents(db: LibraryDatabase, expected: PartDependents) {
  if (
    !isDeepStrictEqual(
      partDependents(
        db,
        expected.map((item) => item.ref),
      ),
      expected,
    )
  ) {
    throw new DesktopError('TargetChanged', 'A part’s work or file associations changed')
  }
}

function releaseImages(write: LibraryWrite, row: PartDetails) {
  if (row.data.primaryImageId) {
    write.released.add(row.data.primaryImageId)
  }
  const links = parts[row.ref.type].images
  for (const image of write.db
    .select({ id: links.attachmentId })
    .from(links)
    .where(eq(links.ownerId, row.ref.id))
    .all()) {
    write.released.add(image.id)
  }
}

export function removePart(write: LibraryWrite, ref: PartRef) {
  const row = requirePart(write.db, ref)
  releaseImages(write, row)
  const schema = parts[ref.type]
  write.db.delete(schema.table).where(eq(schema.table.id, ref.id)).run()
  write.changes.push({ type: 'partDeleted', part: ref, work: row.work } as Extract<
    LibraryWrite['changes'][number],
    { type: 'partCreated' | 'partUpdated' | 'partDeleted' | 'partRecordChanged' }
  >)
}

export function correctAnimeKind(
  write: LibraryWrite,
  ref: PartRef<'animeEpisode' | 'animeExtra'>,
  input: PartKindChange,
) {
  const current = requirePart(write.db, ref)
  const from = parts[ref.type],
    to = parts[input.target.kind]
  expectFields(current.data, input.expected)
  const data: Record<string, unknown> = {
    ...current.data,
    ...input.changes,
    type: input.target.type,
  }
  delete data.numberLabel
  if (input.target.kind === 'animeEpisode') {
    data.numberLabel = input.target.numberLabel
  }

  const firstEvent = write.changes.length
  if (getPart(write.db, { id: ref.id, type: input.target.kind })) {
    throw new DesktopError('Conflict', 'The destination kind already contains this identity')
  }
  const create = parsePartCreate({
    type: input.target.kind,
    work: current.work,
    data,
    completed: current.completed,
  })
  insertPart(write, create, ref.id, current.createdAt)
  const links = write.db.select().from(from.files).where(eq(from.files.partId, ref.id)).all()
  for (const link of links) {
    write.db.insert(to.files).values(link).run()
  }
  write.db.run(
    sql`update ${from.activity} set ${sql.identifier(from.activityPart.name)}=null,${sql.identifier(to.activityPart.name)}=${ref.id} where ${from.activityPart}=${ref.id}`,
  )
  releaseImages(write, current)
  write.db.delete(from.table).where(eq(from.table.id, ref.id)).run()
  write.changes.splice(firstEvent)
  const next = { type: input.target.kind, id: ref.id }
  write.changes.push({
    type: 'partKindChanged',
    fromPart: ref,
    toPart: next,
    work: { type: 'anime', id: current.work.id },
  })
  return next
}

export function mergeParts(write: LibraryWrite, source: PartRef, target: PartRef) {
  if (source.type !== target.type) {
    throw new DesktopError('InvalidReference', 'Only parts of the same kind can be merged')
  }
  if (source.id === target.id) {
    throw new DesktopError('InvalidInput', 'Choose two different parts')
  }
  const old = getPart(write.db, source),
    kept = getPart(write.db, target)
  if (!old || !kept) {
    throw new DesktopError('NotFound', 'A selected part no longer exists')
  }
  if (old.work.id !== kept.work.id) {
    throw new DesktopError('InvalidReference', 'The parts belong to different works')
  }
  const schema = parts[target.type]
  const { db } = write
  const fields: Record<string, unknown> = {}
  for (const [key, value] of Object.entries<unknown>({ ...old.data })) {
    if (key === 'externalIdentities') {
      continue
    }
    const current: unknown = Reflect.get(kept.data, key)
    if (
      (current === null || current === '' || (Array.isArray(current) && !current.length)) &&
      value !== null
    ) {
      fields[key] = value
    }
  }
  changePart(write, parsePartUpdate({ ref: target, changes: fields }))
  db.update(schema.identities)
    .set({ ownerId: target.id })
    .where(eq(schema.identities.ownerId, source.id))
    .run()
  if (old.completed && !kept.completed) {
    completePart(write, target, true)
  }

  const found = db.select().from(schema.files).where(eq(schema.files.partId, target.id)).all()
  const existing = new Set(found.map((link) => link.fileId))
  const hasPreferred = found.some((link) => link.isPreferred)
  const moving = db.select().from(schema.files).where(eq(schema.files.partId, source.id)).all()
  for (const link of moving) {
    const preferred = link.isPreferred && !hasPreferred
    if (!existing.has(link.fileId)) {
      db.insert(schema.files)
        .values({ ...link, partId: target.id, isPreferred: preferred })
        .run()
    } else if (preferred) {
      db.update(schema.files)
        .set({ isPreferred: true })
        .where(and(eq(schema.files.fileId, link.fileId), eq(schema.files.partId, target.id)))
        .run()
    }
  }
  if (target.type === 'comicVolume') {
    const sourceRows = db
      .select()
      .from(chapters)
      .where(eq(chapters.volumeId, source.id))
      .orderBy(chapters.sortOrder, chapters.chapterId)
      .all()
    let order =
      (db
        .select({ n: max(chapters.sortOrder) })
        .from(chapters)
        .where(eq(chapters.volumeId, target.id))
        .get()!.n ?? -1) + 1
    for (const row of sourceRows) {
      if (
        db
          .insert(chapters)
          .values({ ...row, volumeId: target.id, sortOrder: order })
          .onConflictDoNothing()
          .run().changes
      ) {
        order++
      }
    }
  } else if (target.type === 'comicChapter') {
    const sourceRows = db.select().from(chapters).where(eq(chapters.chapterId, source.id)).all()
    for (const row of sourceRows) {
      db.insert(chapters)
        .values({ ...row, chapterId: target.id })
        .onConflictDoNothing()
        .run()
    }
  }
  db.run(
    sql`update ${schema.activity} set ${sql.identifier(schema.activityPart.name)}=${target.id} where ${schema.activityPart}=${source.id}`,
  )
  releaseImages(write, old)
  db.delete(schema.table).where(eq(schema.table.id, source.id)).run()
  write.changes.push({
    type: 'partMerged',
    source: { ref: source, name: old.data.name, externalIdentities: old.data.externalIdentities },
    target,
    work: kept.work,
  })
  return target
}
