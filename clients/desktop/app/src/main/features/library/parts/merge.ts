import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { parsePartUpdate, type PartRef } from '@kisaki3/desktop-contracts/library'
import { eq } from 'drizzle-orm'
import { mergePartLinks } from '../holdings/files/associations'
import { movePartActivities } from '../records/activities/references'
import type { LibraryWrite } from '../transaction'
import { mergeChapterMemberships } from './comic/volume-chapters/storage'
import { releasePartImages } from './images'
import { parts } from './tables'
import { changePart, completePart, getPart } from './write'

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

  mergePartLinks(db, source, target)
  if (target.type === 'comicVolume' || target.type === 'comicChapter') {
    mergeChapterMemberships(db, source, { type: target.type, id: target.id })
  }
  movePartActivities(write, source, target)
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
