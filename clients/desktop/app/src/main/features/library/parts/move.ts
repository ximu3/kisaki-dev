import { partTypes, partWorkType } from '@kisaki3/desktop-contracts/library'
import { eq, sql } from 'drizzle-orm'
import * as s from '../../../infrastructure/database/schema'
import type { FileWork } from '../holdings/files/record'
import type { LibraryWrite } from '../transaction'
import { parts } from './tables'

export function moveParts(write: LibraryWrite, source: FileWork, target: FileWork) {
  const { db } = write
  for (const kind of partTypes.filter((k) => partWorkType(k) === target.type)) {
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
        fromWork: source,
        toWork: target,
      })
    }
  }
  if (target.type === 'comic') {
    db.update(s.comicVolumeChapters)
      .set({ comicId: target.id })
      .where(eq(s.comicVolumeChapters.comicId, source.id))
      .run()
  }
}
