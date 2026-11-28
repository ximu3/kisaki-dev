import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { and, eq } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  CompletionCreateItem,
  CompletionFields,
  CompletionInitialization,
  CompletionUpdate,
  WorkRef,
} from '@kisaki3/desktop-contracts/library'
import { workCompletionRecords as records } from '../../../../infrastructure/database/schema'
import { expectFields, type LibraryWrite } from '../../transaction'
import { requireEntry } from '../../entries/tables'
import { readWorkRecord, saveWorkRecord, completionTotal } from '../work'

export function addCompletion({ db, now }: LibraryWrite, work: WorkRef, value: CompletionFields) {
  const id = randomUUID()
  db.insert(records)
    .values({
      id,
      workId: work.id,
      workType: work.type,
      completedDate: value.completedDate,
      note: value.note,
      createdAt: now,
      updatedAt: now,
    })
    .run()
  return id
}

export function recordBatch(
  write: LibraryWrite,
  items: readonly CompletionCreateItem[],
  clearStatus: boolean,
) {
  const { db } = write
  const baselines = new Map<string, { work: WorkRef; count: number }>()
  const previous = new Map<string, CompletionFields>()
  const accepted: CompletionCreateItem[] = []

  for (const item of items) {
    const { work, expected, completedDate, note } = item
    let baseline = baselines.get(work.id)
    if (!baseline) {
      requireEntry(db, work)
      baseline = {
        work,
        count: completionTotal(db, work.id, readWorkRecord(db, work).additionalCompletionCount),
      }
      baselines.set(work.id, baseline)
    } else if (baseline.work.type !== work.type) {
      throw new DesktopError('InvalidReference', 'The selected work has a different type')
    }
    if (expected && expected.completionCount !== baseline.count) {
      throw new DesktopError('Conflict', 'The completion count has changed')
    }

    const fields = { completedDate, note } as CompletionFields
    if (clearStatus && previous.has(work.id)) {
      if (!isDeepStrictEqual(fields, previous.get(work.id))) {
        throw new DesktopError('InvalidInput', 'Conflicting completion details for the same work')
      }
      continue
    }
    previous.set(work.id, fields)
    accepted.push(item)
  }

  const result = accepted.map((item) => ({
    work: item.work,
    completionId: addCompletion(write, item.work, item),
  }))
  for (const { work } of baselines.values()) {
    const record = readWorkRecord(db, work)
    if (clearStatus && record.status !== null) {
      saveWorkRecord(db, work, { ...record, status: null })
    } else {
      completionTotal(db, work.id, record.additionalCompletionCount)
    }
    write.changes.push({ type: 'workRecordChanged', work })
  }
  return result
}

export function initializeHistory(
  write: LibraryWrite,
  work: WorkRef,
  input: CompletionInitialization,
) {
  requireEntry(write.db, work)
  const record = readWorkRecord(write.db, work)
  if (completionTotal(write.db, work.id, record.additionalCompletionCount) !== 0) {
    throw new DesktopError('Conflict', 'Completion history is already present')
  }

  const ids = input.records.map((row) => addCompletion(write, work, row))
  saveWorkRecord(write.db, work, {
    ...record,
    additionalCompletionCount: input.additionalCompletionCount,
    status: input.clearCurrentStatus ? null : record.status,
  })
  write.changes.push({ type: 'workRecordChanged', work })
  return ids
}

export function editCompletion(
  write: LibraryWrite,
  work: WorkRef,
  id: string,
  input: CompletionUpdate | null,
) {
  const target = and(
    eq(records.id, id),
    eq(records.workId, work.id),
    eq(records.workType, work.type),
  )
  const old = write.db.select().from(records).where(target).get()
  if (!old) {
    throw new DesktopError('NotFound', 'The completion record does not exist')
  }

  if (input) {
    const before = { completedDate: old.completedDate, note: old.note }
    expectFields(before, input.expected)
    const after = { ...before, ...input.changes }
    if (!after.completedDate && !after.note?.trim()) {
      throw new DesktopError('InvalidInput', 'Provide a completion date or a note')
    }
    if (isDeepStrictEqual(before, after)) {
      return
    }
    write.db
      .update(records)
      .set({ ...after, updatedAt: write.now })
      .where(target)
      .run()
  } else {
    write.db.delete(records).where(target).run()
  }
  write.changes.push({ type: 'workRecordChanged', work })
}
