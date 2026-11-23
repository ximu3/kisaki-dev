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
  fromParser,
  nonemptyText,
  nonnegativeNumber,
  parseValue,
  id,
  text,
  timestamp,
  unique,
} from './validation'
import { parseJsonValue, type JsonValue } from './json'
import { parseErrorSummary, type ErrorSummary } from './errors'

export interface TaskRunRef {
  readonly taskRunId: string
}

const terminalStatuses = ['completed', 'failed', 'cancelled', 'interrupted'] as const

export const taskRunStatuses = Object.freeze([
  'queued',
  'running',
  'pausing',
  'paused',
  'cancelling',
  ...terminalStatuses,
] as const)

export type TaskRunStatus = (typeof taskRunStatuses)[number]

export type TaskTerminalStatus = (typeof terminalStatuses)[number]

/** Reaching the reported total does not finish the task. */
export type TaskProgress =
  | { readonly phase: string }
  | { readonly phase?: string; readonly completed: number; readonly total: number }

export interface TaskState {
  readonly taskRunId: string

  readonly status: TaskRunStatus
  readonly progress: TaskProgress | null

  readonly canPause: boolean
  readonly canResume: boolean
  readonly canCancel: boolean
}

/** Times are Unix milliseconds. A failed run can carry both an error and a valid partial result. */
export interface TaskRun<Result = JsonValue, Input = JsonValue> {
  readonly id: string
  readonly type: string
  readonly title: string
  readonly description: string | null

  readonly status: TaskRunStatus
  readonly input: Input | null
  readonly result: Result | null
  readonly error: ErrorSummary | null

  readonly createdAt: number
  readonly startedAt: number | null
  readonly finishedAt: number | null
}

export type TaskRunSummary = Omit<TaskRun, 'input' | 'result'>

export type TaskTerminalRun<Result = JsonValue, Input = JsonValue> = Omit<
  TaskRun<Result, Input>,
  'status'
> & { readonly status: TaskTerminalStatus }

export interface TaskDefinition<Input = JsonValue> {
  readonly type: string
  readonly title: string
  readonly description?: string | null
  readonly input?: Input | null
  /** Defaults to false; only executions with real safe checkpoints can enable pause controls. */
  readonly supportsPause?: boolean
}

export interface TaskExecutionContext<Result> extends ExecutionContext {
  readonly ref: TaskRunRef

  /** Honors pause and cancellation at a safe point. Release synchronous database transactions before waiting. */
  checkpoint(): Promise<void>

  /** Publishes live progress independently of the saved result. */
  reportProgress(progress: TaskProgress): void

  /** Resolves after the checkpoint is saved. A write failure stops further work. */
  reportResult(result: Result): Promise<void>
}

export interface TaskQuery {
  readonly types?: readonly string[]
  readonly statuses?: readonly TaskRunStatus[]
  /** Inclusive creation-time lower bound in UTC milliseconds since the Unix epoch. */
  readonly createdFrom?: number
  /** Exclusive creation-time upper bound in UTC milliseconds since the Unix epoch. */
  readonly createdBefore?: number
  readonly search?: string
}

export interface TaskHistoryFilter {
  readonly types?: readonly string[]
  /** Exclusive creation-time upper bound in UTC milliseconds since the Unix epoch. */
  readonly createdBefore?: number
}

/** Pause, resume and cancel on an ended run return its terminal state without restarting work. */
export interface TasksApi {
  /** Waits for execution and cleanup. Cancellation preserves completed work and any valid partial result. */
  run<Result, Input = JsonValue>(
    definition: TaskDefinition<Input>,
    execute: (context: TaskExecutionContext<Result>) => Promise<Result>,
    call?: CallOptions,
  ): Promise<Result>

  list(
    query: TaskQuery,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<TaskRunSummary>>

  /** After execution ends, history can confirm only the last successful write. */
  get(ref: TaskRunRef, call?: CallOptions): Promise<TaskRun | null>

  /** Delivers the current state first. Disposing the observation leaves the task running. */
  observe(ref: TaskRunRef, listener: Listener<TaskState>, call?: CallOptions): Promise<Disposable>

  /**
   * A live waiter receives the execution outcome, including a valid result if the final history write fails.
   * After the live run is released, a new wait reads the last saved checkpoint. An unconfirmed
   * completion appears as interrupted. Cancelling the wait leaves the task running.
   */
  wait(ref: TaskRunRef, call?: CallOptions): Promise<TaskTerminalRun>

  /** Requests a pause at the next safe checkpoint. Returns the current control state. */
  pause(ref: TaskRunRef, call?: CallOptions): Promise<TaskState>

  /** Withdraws a pending pause or releases a paused task. */
  resume(ref: TaskRunRef, call?: CallOptions): Promise<TaskState>

  /** Requests cancellation. Wait for the task to observe its final result after cleanup. */
  cancel(ref: TaskRunRef, call?: CallOptions): Promise<TaskState>

  /** Deletes matching terminal records and returns their count. Business reports and recovery records survive. */
  clearHistory(filter?: TaskHistoryFilter, call?: CallOptions): Promise<number>

  /**
   * Subscribe before querying. History writes and status changes that affect query membership
   * invalidate the read. Observe the run for live progress.
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

export function isTaskTerminal(status: TaskRunStatus): status is TaskTerminalStatus {
  return terminalStatuses.some((terminal) => terminal === status)
}

export function parseTaskRunRef(input: unknown): TaskRunRef {
  return parseValue(v.strictObject({ taskRunId: id }), input, 'Invalid task reference')
}

export function parseTaskProgress(input: unknown): TaskProgress {
  return parseValue(progress, input, 'Invalid task progress')
}

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
      v.check(({ status, canPause, canResume, canCancel }) => {
        if (isTaskTerminal(status) || status === 'cancelling') {
          return !canPause && !canResume && !canCancel
        }
        return (
          (!canResume || status === 'paused' || status === 'pausing') &&
          (!canPause || status === 'queued' || status === 'running')
        )
      }),
    ),
    input,
    'Invalid task observation',
  )
}

/** Wall-clock timestamps need not be monotonic. */
export function parseTaskRun(input: unknown): TaskRun {
  return parseValue(
    v.strictObject({
      id,
      type: nonemptyText,
      title: nonemptyText,
      description: v.nullable(text),

      status: v.picklist(taskRunStatuses),
      input: fromParser(parseJsonValue),
      result: fromParser(parseJsonValue),
      error: v.nullable(fromParser(parseErrorSummary)),

      createdAt: timestamp,
      startedAt: v.nullable(timestamp),
      finishedAt: v.nullable(timestamp),
    }),
    input,
    'Invalid task history',
  )
}

export function parseTaskDefinition(input: unknown): TaskDefinition {
  return parseValue(
    v.strictObject({
      type: nonemptyText,
      title: nonemptyText,
      description: v.exactOptional(v.nullable(text)),
      input: v.exactOptional(fromParser(parseJsonValue)),
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
