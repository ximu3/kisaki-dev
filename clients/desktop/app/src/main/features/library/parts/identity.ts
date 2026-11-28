import { isDeepStrictEqual } from 'node:util'
import { and, eq, sql } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { parsePartUpdate, type PartRef } from '@kisaki3/desktop-contracts/library'
import type { LibraryWrite, LibraryDatabase } from '../transaction'
import { mergeChapterMemberships } from './comic/merge'
import { releasePartImages } from './images'
import { parts } from './tables'
import { getPart, requirePart, changePart, completePart } from './write'

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

export function removePart(write: LibraryWrite, ref: PartRef) {
  const row = requirePart(write.db, ref)
  releasePartImages(write, row)
  const schema = parts[ref.type]
  write.db.delete(schema.table).where(eq(schema.table.id, ref.id)).run()
  write.changes.push({ type: 'partDeleted', part: ref, work: row.work } as Extract<
    LibraryWrite['changes'][number],
    { type: 'partCreated' | 'partUpdated' | 'partDeleted' | 'partRecordChanged' }
  >)
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
  if (target.type === 'comicVolume' || target.type === 'comicChapter') {
    mergeChapterMemberships(db, source, { type: target.type, id: target.id })
  }
  db.run(
    sql`update ${schema.activity} set ${sql.identifier(schema.activityPart.name)}=${target.id} where ${schema.activityPart}=${source.id}`,
  )
  releasePartImages(write, old)
  db.delete(schema.table).where(eq(schema.table.id, source.id)).run()
  write.changes.push({
    type: 'partMerged',
    source: { ref: source, name: old.data.name, externalIdentities: old.data.externalIdentities },
    target,
    work: kept.work,
  })
  return target
}
