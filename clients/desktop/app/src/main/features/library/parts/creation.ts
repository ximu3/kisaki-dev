import { eq, max } from 'drizzle-orm'
import type { LibraryWrite } from '../transaction'
import type { AnySQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'

export function newPartRow(
  write: LibraryWrite,
  schema: {
    table: SQLiteTable & { sortOrder: AnySQLiteColumn<{ data: number }> }
    owner: AnySQLiteColumn<{ data: string }>
  },
  workId: string,
  id: string,
  createdAt: number,
) {
  const maximum = write.db
    .select({ n: max(schema.table.sortOrder) })
    .from(schema.table)
    .where(eq(schema.owner, workId))
    .get()!.n
  return { id, sortOrder: (maximum ?? -1) + 1, createdAt, updatedAt: write.now }
}

export type PartRow = ReturnType<typeof newPartRow>
