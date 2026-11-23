import { and, count, desc, eq, inArray, lt, gte, sql, type SQL } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { StoredDefinition, ListOptions } from '@kisaki3/desktop-contracts/operations'
import type { JsonValue } from '@kisaki3/desktop-contracts/json'
import {
  isTaskTerminal,
  taskRunStatuses,
  type TaskRun,
  type TaskQuery,
  type TaskRunStatus,
  type TaskHistoryFilter,
  type TaskTerminalRun,
} from '@kisaki3/desktop-contracts/tasks'
import type { Storage } from '../../infrastructure/database'
import { taskRuns } from '../../infrastructure/database/schema/history'
import { ready } from '../../infrastructure/database/codecs/json'

const activeStatuses = taskRunStatuses.filter((status) => !isTaskTerminal(status))

/** Requires a usable stored field when the caller asks for its value. */
function unwrap<T>(value: StoredDefinition<T> | null): T | null {
  if (value?.status === 'invalid') {
    throw new DesktopError(value.error.code, value.error.message)
  }
  return value?.value ?? null
}

/** Orphaned histories have an unconfirmed ending even if they last recorded an active state. */
function projectedStatus(active: ReadonlyArray<readonly [string, TaskRunStatus]>) {
  const live = active.map(([id, status]) => sql`when ${taskRuns.id} = ${id} then ${status} `)
  return sql<TaskRunStatus>`case ${sql.join(live)} when ${inArray(taskRuns.status, activeStatuses)} then 'interrupted' else ${taskRuns.status} end`
}

function endedStatus(status: TaskRunStatus): TaskTerminalRun['status'] {
  return isTaskTerminal(status) ? status : 'interrupted'
}

/** Builds worker operations on the generic history table, independent of business-owned reports. */
export function taskHistory(storage: Storage) {
  const db = storage.db

  function readRecord(id: string): TaskRun | null {
    const row = db.select().from(taskRuns).where(eq(taskRuns.id, id)).get()
    if (!row) {
      return null
    }

    return {
      ...row,
      input: unwrap(row.input),
      result: unwrap(row.result),
      error: unwrap(row.error),
    }
  }

  return {
    taskTypes() {
      return db
        .selectDistinct({ type: taskRuns.type })
        .from(taskRuns)
        .orderBy(taskRuns.type)
        .all()
        .map((row) => row.type)
    },

    /** Records incomplete executions from the previous process without inventing an ending time. */
    interruptTasks() {
      db.update(taskRuns)
        .set({ status: 'interrupted', finishedAt: null })
        .where(inArray(taskRuns.status, activeStatuses))
        .run()
    },

    startTask(run: TaskRun) {
      db.insert(taskRuns)
        .values({
          ...run,
          input: run.input === null ? null : ready(run.input),
          result: null,
          error: null,
        })
        .run()
    },
    checkpointTask(id: string, result: JsonValue) {
      db.update(taskRuns)
        .set({ result: ready(result) })
        .where(eq(taskRuns.id, id))
        .run()
    },
    finishTask(run: TaskTerminalRun) {
      db.update(taskRuns)
        .set({
          status: run.status,
          finishedAt: run.finishedAt,
          result: run.result === null ? null : ready(run.result),
          error: run.error && ready(run.error),
        })
        .where(eq(taskRuns.id, run.id))
        .run()
    },

    getTask(id: string, active: TaskRunStatus | null): TaskRun | null {
      const record = readRecord(id)
      return record && { ...record, status: active ?? endedStatus(record.status) }
    },
    getEndedTask(id: string): TaskTerminalRun | null {
      const record = readRecord(id)
      return record && { ...record, status: endedStatus(record.status) }
    },

    /** Reads a summary interval and its total from one snapshot, excluding input and result bytes. */
    listTasks(
      query: TaskQuery,
      options: ListOptions,
      active: ReadonlyArray<readonly [string, TaskRunStatus]>,
    ) {
      const status = projectedStatus(active)
      const conditions: SQL[] = []
      if (query.types) {
        conditions.push(inArray(taskRuns.type, [...query.types]))
      }
      if (query.statuses) {
        conditions.push(inArray(status, [...query.statuses]))
      }
      if (query.createdFrom !== undefined) {
        conditions.push(gte(taskRuns.createdAt, query.createdFrom))
      }
      if (query.createdBefore !== undefined) {
        conditions.push(lt(taskRuns.createdAt, query.createdBefore))
      }
      if (query.search) {
        conditions.push(
          sql`(instr(lower(${taskRuns.title}),lower(${query.search})) or instr(lower(${taskRuns.description}),lower(${query.search})))`,
        )
      }
      const filter = and(...conditions)
      return storage.transaction((tx) => {
        const items = tx
          .select({
            id: taskRuns.id,
            type: taskRuns.type,
            title: taskRuns.title,
            description: taskRuns.description,
            status,
            error: taskRuns.error,
            createdAt: taskRuns.createdAt,
            startedAt: taskRuns.startedAt,
            finishedAt: taskRuns.finishedAt,
          })
          .from(taskRuns)
          .where(filter)
          .orderBy(desc(taskRuns.createdAt), taskRuns.id)
          .limit(options.limit)
          .offset(options.offset)
          .all()
        const total = tx.select({ value: count() }).from(taskRuns).where(filter).get()!.value
        return { items: items.map((row) => ({ ...row, error: unwrap(row.error) })), total }
      })
    },

    clearTasks(filter: TaskHistoryFilter, active: readonly string[], id?: string) {
      const conditions: SQL[] = id === undefined ? [] : [eq(taskRuns.id, id)]
      if (filter.types) {
        conditions.push(inArray(taskRuns.type, [...filter.types]))
      }
      if (filter.createdBefore !== undefined) {
        conditions.push(lt(taskRuns.createdAt, filter.createdBefore))
      }

      // A history whose live context has ended may still show its last saved checkpoint.
      if (active.length) {
        conditions.push(sql`not ${inArray(taskRuns.id, [...active])}`)
      }
      return db
        .delete(taskRuns)
        .where(and(...conditions))
        .run().changes
    },
  }
}
