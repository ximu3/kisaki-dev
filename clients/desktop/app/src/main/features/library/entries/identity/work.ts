import { eq, and, sql } from 'drizzle-orm'
import { partTypes, partWorkType, type WorkRef } from '@kisaki3/desktop-contracts/library'
import * as s from '../../../../infrastructure/database/schema'
import { parts } from '../../parts/tables'
import { mergeFile } from '../../holdings/files/merge'
import { directories, mediaFiles } from '../../holdings/tables'
import type { LibraryWrite } from '../../transaction'
import { activityTables } from '../tables'
import { tables as annotationTables } from '../../records/annotations/read'
import type { MergeLocations } from './locations'

export function mergeWork(
  write: LibraryWrite,
  source: WorkRef,
  target: WorkRef,
  locations: MergeLocations,
) {
  const { db } = write,
    dir = directories[target.type]
  db.run(
    sql`update ${dir.table} set ${sql.identifier(dir.owner.name)}=${target.id} where ${dir.owner}=${source.id}`,
  )
  const activity = activityTables[target.type],
    annotations = annotationTables[target.type]
  db.run(
    sql`update ${activity.table} set ${sql.identifier(activity.owner.name)}=${target.id} where ${activity.owner}=${source.id}`,
  )
  db.run(
    sql`update ${annotations.table} set ${sql.identifier(annotations.owner.name)}=${target.id} where ${annotations.owner}=${source.id}`,
  )
  db.update(s.workCompletionRecords)
    .set({ workId: target.id })
    .where(eq(s.workCompletionRecords.workId, source.id))
    .run()
  if (target.type === 'game') {
    const c = s.gameLaunchConfigs
    const preferred = db
      .select({ id: c.id })
      .from(c)
      .where(and(eq(c.gameId, target.id), eq(c.isPreferred, true)))
      .get()
    const rows = db.select().from(c).where(eq(c.gameId, source.id)).orderBy(c.sortOrder, c.id).all()
    let offset = Number(
      db.get<{ n: bigint }>(
        sql`select coalesce(max(sort_order),-1)+1 n from ${c} where game_id=${target.id}`,
      )!.n,
    )
    for (const row of rows) {
      db.update(c)
        .set({ gameId: target.id, sortOrder: offset++, isPreferred: !preferred && row.isPreferred })
        .where(eq(c.id, row.id))
        .run()
    }
    db.update(s.gameSaveBackups)
      .set({ gameId: target.id })
      .where(eq(s.gameSaveBackups.gameId, source.id))
      .run()
    db.update(s.gameBackupRecoveries)
      .set({ gameId: target.id })
      .where(eq(s.gameBackupRecoveries.gameId, source.id))
      .run()
    return
  }
  const work = { type: target.type, id: target.id },
    from = { type: target.type, id: source.id }
  for (const kind of partTypes.filter((k) => partWorkType(k) === work.type)) {
    const p = parts[kind],
      owner = sql.identifier(p.owner.name)
    const rows = db
      .select({ id: p.table.id })
      .from(p.table)
      .where(eq(p.owner, source.id))
      .orderBy(p.table.sortOrder, p.table.id)
      .all()
    let next = Number(
      db.get<{ n: bigint }>(
        sql`select coalesce(max(sort_order),-1)+1 n from ${p.table} where ${p.owner}=${target.id}`,
      )!.n,
    )
    for (const row of rows) {
      db.run(
        sql`update ${p.table} set ${owner}=${target.id},sort_order=${next++} where id=${row.id}`,
      )
      write.changes.push({
        type: 'partMoved',
        part: { type: kind, id: row.id },
        fromWork: from,
        toWork: work,
      })
    }
  }
  if (work.type === 'comic') {
    db.update(s.comicVolumeChapters)
      .set({ comicId: target.id })
      .where(eq(s.comicVolumeChapters.comicId, source.id))
      .run()
  }
  const f = mediaFiles[work.type],
    preference = db
      .select({ id: f.table.id })
      .from(f.table)
      .where(and(eq(f.owner, target.id), eq(f.table.isPreferred, true)))
      .get()
  if (preference) {
    db.update(f.table).set({ isPreferred: false }).where(eq(f.owner, source.id)).run()
  }
  for (const pair of locations.duplicates.filter((p) => p.sourceWork === source.id)) {
    mergeFile(write, work, pair, pair.facts, from)
  }
  db.run(
    sql`update ${f.table} set ${sql.identifier(f.owner.name)}=${target.id} where ${f.owner}=${source.id}`,
  )
  for (const kind of f.parts) {
    const table = parts[kind].files
    db.update(table).set({ workId: target.id }).where(eq(table.workId, source.id)).run()
  }
  const table = {
    anime: s.animePlaybackPreferences,
    comic: s.comicReadingPreferences,
    novel: s.novelReadingPreferences,
  }[work.type]
  if (!db.select({ id: table.ownerId }).from(table).where(eq(table.ownerId, target.id)).get()) {
    db.update(table).set({ ownerId: target.id }).where(eq(table.ownerId, source.id)).run()
  }
}
