import {
  partTypes,
  partWorkType,
  type FileWorkType,
  type WorkRef,
} from '@kisaki3/desktop-contracts/library'
import { sql } from 'drizzle-orm'
import { chapterNumbers } from '../../parts/comic/volume-chapters/storage'
import { parts } from '../../parts/tables'
import type { LibraryDatabase } from '../../transaction'
import type { Candidate } from './lookup'

export function candidates(db: LibraryDatabase, work: WorkRef<FileWorkType>) {
  const members = work.type === 'comic' ? chapterNumbers(db, work.id) : undefined
  const result: Candidate[] = []
  for (const kind of partTypes.filter((kind) => partWorkType(kind) === work.type)) {
    const { table, owner } = parts[kind]
    const list = db.all<{
      id: string
      name: string | null
      number: string | null
      classification: string | null
    }>(
      sql`select id,name,${kind === 'animeExtra' ? sql`null` : sql`number_label`} number,${work.type === 'anime' ? sql`type` : sql`null`} classification from ${table} where ${owner}=${work.id} order by sort_order,id`,
    )
    for (const row of list) {
      result.push({
        ...row,
        ref: { type: kind, id: row.id },
        volumes: kind === 'comicChapter' ? (members?.get(row.id) ?? []) : [],
      })
    }
  }
  return result
}
