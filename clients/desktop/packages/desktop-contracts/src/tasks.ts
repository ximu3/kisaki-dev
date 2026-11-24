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
  readonly supportsPause?: boolean
}

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
