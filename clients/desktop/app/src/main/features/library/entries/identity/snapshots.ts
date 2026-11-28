import { eq, sql } from 'drizzle-orm'
import {
  isWorkType,
  partTypes,
  partWorkType,
  type EntryRef,
} from '@kisaki3/desktop-contracts/library'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import * as s from '../../../../infrastructure/database/schema'
import type { UseTarget } from '../../change-admission'
import { readIdentities } from '../identities'
import { catalogTables, entryWhere, activityTables } from '../tables'
import { imageIds } from '../../attachments'
import { parts } from '../../parts/tables'
import { tables as annotations } from '../../records/annotations/read'
import { mediaFiles } from '../../holdings/tables'
import type { LibraryDatabase, LibraryWrite } from '../../transaction'

export function snapshot(db: LibraryDatabase, ref: EntryRef) {
  const row = db.select({ name: s.entries.name }).from(s.entries).where(entryWhere(ref)).get()
  if (!row) {
    throw new DesktopError('NotFound', 'A selected entry no longer exists')
  }
  return { ref, name: row.name, externalIdentities: readIdentities(db, ref.id) }
}
export function dependencies(db: LibraryDatabase, refs: readonly EntryRef[]) {
  const targets: UseTarget[] = []
  for (const ref of refs) {
    if (!isWorkType(ref.type)) {
      continue
    }
    const work = ref.type
    targets.push({ type: 'work', kind: work, id: ref.id })
    for (const type of partTypes.filter((kind) => partWorkType(kind) === work)) {
      const p = parts[type]
      for (const row of db
        .select({ id: p.table.id })
        .from(p.table)
        .where(eq(p.owner, ref.id))
        .all()) {
        targets.push({ type: 'part', kind: type, id: row.id })
      }
    }
    const activity = activityTables[work]
    for (const row of db
      .select({ id: activity.table.id })
      .from(activity.table)
      .where(eq(activity.owner, ref.id))
      .all()) {
      targets.push({ type: 'activity', kind: work, id: row.id })
    }
    if (work === 'game') {
      for (const c of db
        .select({ id: s.gameLaunchConfigs.id })
        .from(s.gameLaunchConfigs)
        .where(eq(s.gameLaunchConfigs.gameId, ref.id))
        .all()) {
        targets.push({ type: 'configuration', kind: work, id: c.id })
      }
    } else {
      const file = mediaFiles[work]
      for (const f of db
        .select({ id: file.table.id })
        .from(file.table)
        .where(eq(file.owner, ref.id))
        .all()) {
        targets.push({ type: 'file', kind: work, id: f.id })
      }
    }
  }
  return targets.sort(
    (a, b) =>
      a.type.localeCompare(b.type) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id),
  )
}
export function retireEntryImages(write: LibraryWrite, ref: EntryRef) {
  const { db } = write,
    sub = catalogTables[ref.type]
  const base = db.select().from(s.entries).where(entryWhere(ref)).get()!,
    detail = db.select().from(sub).where(eq(sub.entryId, ref.id)).get()
  for (const image of imageIds({ ...base, ...detail })) {
    write.released.add(image)
  }
  if (!isWorkType(ref.type)) {
    return
  }
  const annotation = annotations[ref.type]
  for (const row of db.all<{ id: string }>(
    sql`select image_id id from ${annotation.table} where ${annotation.owner}=${ref.id} and image_id is not null union select attachment_id from ${annotation.images} where ${annotation.images.ownerId} in (select id from ${annotation.table} where ${annotation.owner}=${ref.id})`,
  )) {
    write.released.add(row.id)
  }
  for (const type of partTypes.filter((kind) => partWorkType(kind) === ref.type)) {
    const p = parts[type]
    for (const row of db.all<{ id: string }>(
      sql`select primary_image_id id from ${p.table} where ${p.owner}=${ref.id} and primary_image_id is not null union select attachment_id from ${p.images} where ${p.images.ownerId} in (select id from ${p.table} where ${p.owner}=${ref.id})`,
    )) {
      write.released.add(row.id)
    }
  }
  if (ref.type === 'game') {
    for (const row of db
      .select({ id: s.gameSaveBackups.archiveAttachmentId })
      .from(s.gameSaveBackups)
      .where(eq(s.gameSaveBackups.gameId, ref.id))
      .all()) {
      write.released.add(row.id)
    }
  }
}
