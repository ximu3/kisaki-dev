import type { FileWorkType, WorkRef } from '@kisaki3/desktop-contracts/library'
import { sql } from 'drizzle-orm'
import type { LibraryDatabase } from '../../../transaction'
import { directories } from '../../directories/tables'
import { mediaFiles } from '../../files/tables'

export interface WatchTarget {
  work: WorkRef<FileWorkType>
  id: string
  path: string
  kind: 'root' | 'file' | 'pages'
  profileId: string | null
  discovery: string | null
}

export function watchTargets(db: LibraryDatabase) {
  const ranges: WatchTarget[] = []
  for (const type of ['anime', 'comic', 'novel'] as const) {
    const d = directories[type],
      f = mediaFiles[type]
    for (const row of db
      .select({
        id: d.table.id,
        workId: d.owner,
        path: d.table.path,
        profileId: d.table.recognitionProfileId,
        definition: d.table.definition,
      })
      .from(d.table)
      .all()) {
      ranges.push({
        id: row.id,
        path: row.path,
        work: { type, id: row.workId },
        kind: 'root',
        profileId: row.profileId,
        discovery: JSON.stringify(row.definition),
      })
    }
    const kind = type === 'anime' ? sql<string>`'file'` : sql<string>`kind`
    for (const row of db
      .select({ workId: f.owner, id: f.table.id, path: f.table.path, kind })
      .from(f.table)
      .all()) {
      ranges.push({
        work: { type, id: row.workId },
        id: row.id,
        path: row.path,
        kind: row.kind === 'directory' ? 'pages' : 'file',
        profileId: null,
        discovery: null,
      })
    }
  }
  return ranges
}
