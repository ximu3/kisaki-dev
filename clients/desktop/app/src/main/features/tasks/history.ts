/** @fileoverview Stores confirmed task checkpoints and projects orphaned histories consistently for reads and cleanup. */

import { and, count, desc, eq, inArray, lt, gte, sql, type SQL } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { StoredDefinition, ListOptions } from '@kisaki3/desktop-contracts/operations'
import type { JsonValue } from '@kisaki3/desktop-contracts/json'
import type {
  TaskRun,
  TaskQuery,
  TaskRunStatus,
  TaskHistoryFilter,
  TaskTerminalRun,
} from '@kisaki3/desktop-contracts/tasks'
import type { Storage } from '../../infrastructure/database'
import { taskRuns } from '../../infrastructure/database/schema/history'
import { ready } from '../../infrastructure/database/codecs/json'

/** Execution states whose completion cannot be inferred from the last committed checkpoint. */
const unfinished = ['queued', 'running', 'pausing', 'paused', 'cancelling'] as const

/** Requires a usable stored field when the caller asks for its value. */
function unwrap<T>(value: StoredDefinition<T> | null): T | null {
  if (value?.status === 'invalid') {
    throw new DesktopError(value.error.code, value.error.message)
  }
  return value?.value ?? null
}

/** Projects active control states and unconfirmed endings using the same expression for all queries. */
function projectedStatus(active: ReadonlyArray<readonly [string, TaskRunStatus]>) {
  const live = active.map(([id, status]) => sql`when ${taskRuns.id} = ${id} then ${status} `)
  return sql<TaskRunStatus>`case ${sql.join(live)} when ${inArray(taskRuns.status, [...unfinished])} then 'interrupted' else ${taskRuns.status} end`
}

/** Builds worker operations on the generic history table, independent of business-owned reports. */
export function taskHistory(storage: Storage) {
  const db = storage.db
  return {
    /** Provides the history's actual operation types without loading result or input documents. */
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
        .where(inArray(taskRuns.status, [...unfinished]))
        .run()
    },
    /** Commits the required starting record before handing the task to its business callback. */
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
    /** Persists a validated result independently of lightweight progress. */
    checkpointTask(id: string, result: JsonValue) {
      db.update(taskRuns)
        .set({ result: ready(result) })
        .where(eq(taskRuns.id, id))
        .run()
    },
    /** Commits the terminal status, retained result and safe failure as one database write. */
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
    /** Reads full recorded facts for one task under the supplied execution state. */
    getTask(id: string, active: TaskRunStatus | null): TaskRun | null {
      const row = db.select().from(taskRuns).where(eq(taskRuns.id, id)).get()
      if (!row) {
        return null
      }
      const status =
        active ?? (unfinished.some((s) => s === row.status) ? 'interrupted' : row.status)
      return {
        ...row,
        input: unwrap(row.input),
        result: unwrap(row.result),
        error: unwrap(row.error),
        status,
      }
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
      return db.transaction((tx) => {
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
    /** Removes only terminated history within the requested type and time interval. */
    clearTasks(filter: TaskHistoryFilter, active: readonly string[]) {
      const conditions: SQL[] = []
      if (filter.types) {
        conditions.push(inArray(taskRuns.type, [...filter.types]))
      }
      if (filter.createdBefore !== undefined) {
        conditions.push(lt(taskRuns.createdAt, filter.createdBefore))
      }
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
