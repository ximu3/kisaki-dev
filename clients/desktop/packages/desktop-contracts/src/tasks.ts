/** @fileoverview Defines task execution, lightweight control observation and independently retained business-result history. */

import type { JsonValue } from './json'
import type { ErrorSummary } from './errors'
import type {
  ExecutionContext,
  CallOptions,
  ListOptions,
  ListResult,
  Listener,
  Disposable,
} from './operations'
import * as v from 'valibot'
import {
  nonemptyText,
  nonnegativeNumber,
  parseValue,
  id,
  text,
  timestamp,
  unique,
} from './validation'
import { parseJsonValue } from './json'
import { parseErrorSummary } from './errors'

/** Managed execution identity, separate from any business report or source configuration. */
export interface TaskRunRef {
  readonly taskRunId: string
}

export const taskRunStatuses = Object.freeze([
  'queued',
  'running',
  'pausing',
  'paused',
  'cancelling',
  'completed',
  'failed',
  'cancelled',
  'interrupted',
] as const)

/** Managed task lifecycle state from admission through terminal completion. */
export type TaskRunStatus = (typeof taskRunStatuses)[number]

/** Task outcome whose execution and required cleanup have ended. */
export type TaskTerminalStatus = 'completed' | 'failed' | 'cancelled' | 'interrupted'

/**
 * Current phase or known completed-to-total progress.
 *
 * Reaching the total does not itself finish the task.
 */
export type TaskProgress =
  | { readonly phase: string }
  | { readonly phase?: string; readonly completed: number; readonly total: number }

/** Lightweight ordered observation of task progress and currently available controls. */
export interface TaskState {
  readonly taskRunId: string

  readonly status: TaskRunStatus
  readonly progress: TaskProgress | null

  readonly canPause: boolean
  readonly canResume: boolean
  readonly canCancel: boolean
}

/**
 * Persisted task description, lifecycle and validated JSON input and result snapshots.
 *
 * A failed task may retain a valid partial result independently of its error.
 */
export interface TaskRun<Result = JsonValue, Input = JsonValue> {
  readonly id: string
  readonly type: string
  readonly title: string
  readonly description: string | null

  readonly status: TaskRunStatus
  readonly input: Input | null
  readonly result: Result | null
  readonly error: ErrorSummary | null

  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number
  /** UTC milliseconds since the Unix epoch. */
  readonly startedAt: number | null
  /** UTC milliseconds since the Unix epoch. */
  readonly finishedAt: number | null
}

/** Task-history projection omitting full input and result documents. */
export type TaskRunSummary = Omit<TaskRun, 'input' | 'result'>

/** Persisted task outcome restricted to a terminal lifecycle state. */
export type TaskTerminalRun<Result = JsonValue, Input = JsonValue> = Omit<
  TaskRun<Result, Input>,
  'status'
> & { readonly status: TaskTerminalStatus }

/**
 * Task admission metadata, optional recorded input and declared pause support.
 *
 * History stores data rather than the execution callback or context.
 */
export interface TaskDefinition<Input = JsonValue> {
  readonly type: string
  readonly title: string
  readonly description?: string | null
  readonly input?: Input | null
  /** Defaults to false; only executions with real safe checkpoints can enable pause controls. */
  readonly supportsPause?: boolean
}

/**
 * Managed execution identity, cancellation and business-owned progress and persistence checkpoints.
 */
export interface TaskExecutionContext<Result> extends ExecutionContext {
  readonly ref: TaskRunRef

  /**
   * Honors pause and cancellation at a business-owned safe point.
   *
   * Callers must not wait at a checkpoint while holding a synchronous database transaction.
   */
  checkpoint(): Promise<void>

  /**
   * Publishes lightweight progress without replacing the recorded result or declaring completion.
   */
  reportProgress(progress: TaskProgress): void

  /**
   * Persists a validated snapshot of established business facts.
   *
   * Callers await this checkpoint and handle persistence failure.
   */
  reportResult(result: Result): Promise<void>
}

/** Task-history filters for type, state, creation interval and search text. */
export interface TaskQuery {
  readonly types?: readonly string[]
  readonly statuses?: readonly TaskRunStatus[]
  /** Inclusive creation-time lower bound in UTC milliseconds since the Unix epoch. */
  readonly createdFrom?: number
  /** Exclusive creation-time upper bound in UTC milliseconds since the Unix epoch. */
  readonly createdBefore?: number
  readonly search?: string
}

/** Type and creation-time filters for terminal task-history cleanup. */
export interface TaskHistoryFilter {
  readonly types?: readonly string[]
  /** Exclusive creation-time upper bound in UTC milliseconds since the Unix epoch. */
  readonly createdBefore?: number
}

/** Managed task execution, lightweight control observation and independent history access. */
export interface TasksApi {
  /**
   * Admits and owns the callback's execution through business completion and task-owner cleanup.
   *
   * Cancellation preserves established facts and valid partial results.
   */
  run<Result, Input = JsonValue>(
    definition: TaskDefinition<Input>,
    execute: (context: TaskExecutionContext<Result>) => Promise<Result>,
    call?: CallOptions,
  ): Promise<Result>

  /** Reads an interval of persisted task summaries matching the requested scope. */
  list(
    query: TaskQuery,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<TaskRunSummary>>

  /**
   * Reads recorded input, result and error for a task identity, returning null when absent.
   *
   * Historical data does not authorize execution resumption.
   */
  get(ref: TaskRunRef, call?: CallOptions): Promise<TaskRun | null>

  /**
   * Delivers current task control state and subsequent changes and returns the observation
   * lifetime.
   *
   * Ending observation leaves execution running.
   */
  observe(ref: TaskRunRef, listener: Listener<TaskState>, call?: CallOptions): Promise<Disposable>

  /**
   * Waits for a terminal record and returns its recorded outcome.
   *
   * Cancelling this wait leaves the managed execution running.
   */
  wait(ref: TaskRunRef, call?: CallOptions): Promise<TaskTerminalRun>

  /**
   * Requests pause and returns acknowledged control state.
   *
   * The task reaches a pause at its safe checkpoint; terminal calls are idempotent.
   */
  pause(ref: TaskRunRef, call?: CallOptions): Promise<TaskState>

  /**
   * Requests resumption from pause and returns acknowledged control state.
   *
   * Terminal runs remain ended.
   */
  resume(ref: TaskRunRef, call?: CallOptions): Promise<TaskState>

  /**
   * Requests cancellation and returns actual control state.
   *
   * Callers use wait to observe completed cleanup. Terminal control calls are idempotent.
   */
  cancel(ref: TaskRunRef, call?: CallOptions): Promise<TaskState>

  /**
   * Removes matching terminal task history and returns its count.
   *
   * Accepted work and domain-owned reports or recovery records remain intact.
   */
  clearHistory(filter?: TaskHistoryFilter, call?: CallOptions): Promise<number>

  /**
   * Subscribes to task-history invalidation and returns the subscription lifetime.
   *
   * Callers subscribe before reading; runtime progress uses separate observation.
   */
  onInvalidated(listener: () => void): Disposable
}

const progress = v.union([
  v.strictObject({ phase: nonemptyText }),
  v.pipe(
    v.strictObject({
      phase: v.exactOptional(nonemptyText),
      completed: nonnegativeNumber,
      total: v.pipe(v.number(), v.finite(), v.gtValue(0)),
    }),
    v.check((value) => value.completed <= value.total),
  ),
])

/** Checks whether a lifecycle status denotes terminal completion. */
export function isTaskTerminal(status: TaskRunStatus): status is TaskTerminalStatus {
  return (
    status === 'completed' ||
    status === 'failed' ||
    status === 'cancelled' ||
    status === 'interrupted'
  )
}

/** Parses a managed execution reference without resolving live state or history. */
export function parseTaskRunRef(input: unknown): TaskRunRef {
  return parseValue(v.strictObject({ taskRunId: id }), input, 'Invalid task reference')
}

/** Parses a phase or bounded progress ratio while preserving unknown-total reporting. */
export function parseTaskProgress(input: unknown): TaskProgress {
  return parseValue(progress, input, 'Invalid task progress')
}

/**
 * Parses lightweight state and checks that control affordances are legal for its lifecycle status.
 */
export function parseTaskState(input: unknown): TaskState {
  return parseValue(
    v.pipe(
      v.strictObject({
        taskRunId: id,
        status: v.picklist(taskRunStatuses),
        progress: v.nullable(progress),

        canPause: v.boolean(),
        canResume: v.boolean(),
        canCancel: v.boolean(),
      }),
      v.check(
        (value) =>
          (!isTaskTerminal(value.status) ||
            (!value.canPause && !value.canResume && !value.canCancel)) &&
          (value.status !== 'cancelling' ||
            (!value.canPause && !value.canResume && !value.canCancel)) &&
          (!value.canResume || value.status === 'paused' || value.status === 'pausing') &&
          (!value.canPause || value.status === 'queued' || value.status === 'running'),
      ),
    ),
    input,
    'Invalid task observation',
  )
}

/**
 * Parses persisted task data and preserves nullable lifecycle timestamps.
 *
 * Wall-clock values are not forced into monotonic order.
 */
export function parseTaskRun(input: unknown): TaskRun {
  return parseValue(
    v.strictObject({
      id,
      type: nonemptyText,
      title: nonemptyText,
      description: v.nullable(text),

      status: v.picklist(taskRunStatuses),
      input: v.pipe(v.unknown(), v.transform(parseJsonValue)),
      result: v.pipe(v.unknown(), v.transform(parseJsonValue)),
      error: v.nullable(v.pipe(v.unknown(), v.transform(parseErrorSummary))),

      createdAt: timestamp,
      startedAt: v.nullable(timestamp),
      finishedAt: v.nullable(timestamp),
    }),
    input,
    'Invalid task history',
  )
}

/** Parses admission metadata and validates recorded JSON input before execution registration. */
export function parseTaskDefinition(input: unknown): TaskDefinition {
  return parseValue(
    v.strictObject({
      type: nonemptyText,
      title: nonemptyText,
      description: v.exactOptional(v.nullable(text)),
      input: v.exactOptional(v.pipe(v.unknown(), v.transform(parseJsonValue))),
      supportsPause: v.exactOptional(v.boolean()),
    }),
    input,
    'Invalid task definition',
  )
}

/**
 * Parses task filters and a half-open creation-time interval, preserving explicit empty selections.
 */
export function parseTaskQuery(input: unknown): TaskQuery {
  return parseValue(
    v.pipe(
      v.strictObject({
        types: v.exactOptional(
          v.pipe(
            v.array(nonemptyText),
            v.check((types) => unique(types, (type) => type)),
          ),
        ),
        statuses: v.exactOptional(
          v.pipe(
            v.array(v.picklist(taskRunStatuses)),
            v.check((statuses) => unique(statuses, (status) => status)),
          ),
        ),
        createdFrom: v.exactOptional(timestamp),
        createdBefore: v.exactOptional(timestamp),
        search: v.exactOptional(text),
      }),
      v.check(
        (value) =>
          value.createdFrom === undefined ||
          value.createdBefore === undefined ||
          value.createdFrom < value.createdBefore,
      ),
    ),
    input,
    'Invalid task query',
  )
}
