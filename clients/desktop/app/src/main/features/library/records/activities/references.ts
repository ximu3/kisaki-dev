import type { FileWorkType, PartRef, WorkRef } from '@kisaki3/desktop-contracts/library'
import { eq, sql } from 'drizzle-orm'
import { parts } from '../../parts/tables'
import type { LibraryWrite } from '../../transaction'
import { activityTables } from './tables'

export function moveWorkActivities(write: LibraryWrite, source: WorkRef, target: WorkRef) {
  const { db } = write
  const activity = activityTables[target.type]
  db.run(
    sql`update ${activity.table} set ${sql.identifier(activity.owner.name)}=${target.id} where ${activity.owner}=${source.id}`,
  )
}

export function moveFileActivities(
  write: LibraryWrite,
  type: FileWorkType,
  from: string,
  to: string,
) {
  const { table } = activityTables[type]
  write.db.update(table).set({ fileId: to }).where(eq(table.fileId, from)).run()
}

export function movePartActivities(write: LibraryWrite, source: PartRef, target: PartRef) {
  const from = parts[source.type],
    to = parts[target.type]
  const field = sql.identifier(to.activityPart.name)
  const clear =
    source.type === target.type ? sql.empty() : sql`${sql.identifier(from.activityPart.name)}=null,`
  write.db.run(
    sql`update ${from.activity} set ${clear}${field}=${target.id} where ${from.activityPart}=${source.id}`,
  )
}
