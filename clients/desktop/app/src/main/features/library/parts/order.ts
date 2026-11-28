import { isDeepStrictEqual } from 'node:util'
import { and, eq } from 'drizzle-orm'
import type { PartOrderScope, MoveInput, ReorderInput } from '@kisaki3/desktop-contracts/library'
import { orderedIds } from '../ordering'
import type { LibraryWrite } from '../transaction'
import { requireEntry } from '../entries/tables'
import { parts } from './tables'

export function orderParts(
  write: LibraryWrite,
  scope: PartOrderScope,
  input: MoveInput | ReorderInput,
) {
  requireEntry(write.db, scope.work)
  const schema = parts[scope.partType]
  const rows = write.db
    .select({ id: schema.table.id })
    .from(schema.table)
    .where(eq(schema.owner, scope.work.id))
    .orderBy(schema.table.sortOrder, schema.table.id)
    .all()
  const before = rows.map((row) => row.id)
  const order = orderedIds(before, input)
  if (isDeepStrictEqual(order, before)) {
    return
  }
  for (const [index, id] of order.entries()) {
    write.db
      .update(schema.table)
      .set({ sortOrder: index })
      .where(and(eq(schema.table.id, id), eq(schema.owner, scope.work.id)))
      .run()
    if (id !== before[index]) {
      write.changes.push({
        type: 'partUpdated',
        work: scope.work,
        part: { type: scope.partType, id },
      } as Extract<
        LibraryWrite['changes'][number],
        { type: 'partCreated' | 'partUpdated' | 'partDeleted' | 'partRecordChanged' }
      >)
    }
  }
}
