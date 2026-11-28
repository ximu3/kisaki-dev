import {
  parseEvaluationUpdate,
  parseWorkRef,
  parseWorkStatusUpdate,
  type WorkRecord,
  type WorkRef,
} from '@kisaki3/desktop-contracts/library'
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'
import { eq } from 'drizzle-orm'
import { completionTotal } from '../records/completions/read'
import type { LibraryDatabase } from '../transaction'
import { recordTables } from './tables'

export function personalActions(
  update: (target: unknown, fields: unknown, options?: CallOptions) => Promise<void>,
) {
  return {
    setEvaluation(target: unknown, raw: unknown, options?: CallOptions) {
      const { changes, expected } = parseEvaluationUpdate(raw)
      return update(
        target,
        {
          changes: { evaluation: changes },
          ...(expected && { expected: { evaluation: expected } }),
        },
        options,
      )
    },
    setWorkStatus(target: unknown, raw: unknown, options?: CallOptions) {
      const { status, expected } = parseWorkStatusUpdate(raw)
      return update(
        parseWorkRef(target),
        { changes: { record: { status } }, ...(expected && { expected: { record: expected } }) },
        options,
      )
    },
  }
}

export function readWorkRecord(db: LibraryDatabase, work: WorkRef): WorkRecord {
  const table = recordTables[work.type]
  return (
    db
      .select({
        status: table.status,
        additionalDurationMs: table.additionalDurationMs,
        additionalCompletionCount: table.additionalCompletionCount,
      })
      .from(table)
      .where(eq(table.workId, work.id))
      .get() ?? {
      status: null,
      additionalDurationMs: 0,
      additionalCompletionCount: 0,
    }
  )
}

export function saveWorkRecord(db: LibraryDatabase, work: WorkRef, value: WorkRecord) {
  const table = recordTables[work.type]
  completionTotal(db, work.id, value.additionalCompletionCount)
  db.insert(table)
    .values({ workId: work.id, ...value })
    .onConflictDoUpdate({ target: table.workId, set: value })
    .run()
}
