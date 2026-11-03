/** @fileoverview Defines task execution, lightweight control observation and independently retained business-result history. */

import * as v from 'valibot'
import { parseErrorSummary } from './errors'
import type { ErrorSummary } from './errors'
import { parseJsonValue } from './json'
import type { JsonValue } from './json'
import type {
  CallOptions,
  Disposable,
  ListOptions,
  ListResult,
  Listener,
  ExecutionContext,
} from './operations'
import {
  id,
  nonemptyText,
  nonnegativeNumber,
  parseValue,
  text,
  timestamp,
  unique,
} from './validation'

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

export type TaskRunStatus = (typeof taskRunStatuses)[number]
export type TaskTerminalStatus = 'completed' | 'failed' | 'cancelled' | 'interrupted'

/** Unknown ratios report a phase only. Progress reaching total does not itself finish the task. */
export type TaskProgress =
  | { readonly phase: string }
  | { readonly phase?: string; readonly completed: number; readonly total: number }

/** Lightweight ordered observation; it never retransmits complete input or result documents. */
export interface TaskState {
  readonly taskRunId: string

  readonly status: TaskRunStatus
  readonly progress: TaskProgress | null

  readonly canPause: boolean
  readonly canResume: boolean
  readonly canCancel: boolean
}

/** Recorded input/result are validated JSON snapshots. A failed task can retain a legal result independently of its error. */
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

/** Only business code with actual safe checkpoints advertises pause support; histories never store the callback/context. */
export interface TaskDefinition<Input = JsonValue> {
  readonly type: string
  readonly title: string
  readonly description?: string | null
  readonly input?: Input | null
  readonly supportsPause?: boolean
}

/** Reporting a result is a persistence checkpoint and must be awaited; progress stays a lightweight runtime observation. */
export interface TaskExecutionContext<Result> extends ExecutionContext {
  readonly ref: TaskRunRef

  checkpoint(): Promise<void>

  reportProgress(progress: TaskProgress): void
  reportResult(result: Result): Promise<void>
}

export interface TaskQuery {
  readonly types?: readonly string[]
  readonly statuses?: readonly TaskRunStatus[]
  readonly createdFrom?: number
  readonly createdBefore?: number
  readonly search?: string
}

export interface TaskHistoryFilter {
  readonly types?: readonly string[]
  readonly createdBefore?: number
}

/** run waits for business and task-owner cleanup. wait observes a managed run without cancelling it when observation is cancelled. */
export interface TasksApi {
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
  get(ref: TaskRunRef, call?: CallOptions): Promise<TaskRun | null>
  observe(ref: TaskRunRef, listener: Listener<TaskState>, call?: CallOptions): Promise<Disposable>
  wait(ref: TaskRunRef, call?: CallOptions): Promise<TaskTerminalRun>

  /** Control completion acknowledges the current real state, not immediate business termination. Terminal calls are idempotent. */
  pause(ref: TaskRunRef, call?: CallOptions): Promise<TaskState>
  resume(ref: TaskRunRef, call?: CallOptions): Promise<TaskState>
  cancel(ref: TaskRunRef, call?: CallOptions): Promise<TaskState>

  clearHistory(filter?: TaskHistoryFilter, call?: CallOptions): Promise<number>

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

/** Classify only the real terminal status, never a progress ratio or the availability of a partial result. */
export function isTaskTerminal(status: TaskRunStatus): status is TaskTerminalStatus {
  return (
    status === 'completed' ||
    status === 'failed' ||
    status === 'cancelled' ||
    status === 'interrupted'
  )
}

/** Validate a task reference without searching history to infer its live execution. */
export function parseTaskRunRef(input: unknown): TaskRunRef {
  return parseValue(v.strictObject({ taskRunId: id }), input, 'Invalid task reference')
}

/** Validate progress without manufacturing a percentage when the total is not known. */
export function parseTaskProgress(input: unknown): TaskProgress {
  return parseValue(progress, input, 'Invalid task progress')
}

/** Validate lightweight state and reject impossible control affordances for completed or cancelling runs. */
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

/** Parse the persisted shape without inventing finishedAt or forcing wall-clock timestamps into monotonic order. */
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

/** A nonterminal persisted row with no runtime owner is an unconfirmed interrupted history, not resumed work. */
export function projectTaskHistory<Result, Input>(
  run: TaskRun<Result, Input>,
  hasExecution: boolean,
): TaskRun<Result, Input> {
  return !hasExecution && !isTaskTerminal(run.status)
    ? { ...run, status: 'interrupted', finishedAt: null }
    : run
}

/** Validate an execution descriptor's JSON input before any side effect or initial history registration. */
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

/** Local task lists preserve explicit empty filters and use a half-open creation-time interval. */
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
