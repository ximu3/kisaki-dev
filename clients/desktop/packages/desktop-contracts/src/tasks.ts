/** @fileoverview Defines task execution, actual control snapshots, independent history, and completion facts. */

import type { ErrorSummary } from './errors'
import type {
  CallOptions,
  Disposable,
  ExecutionContext,
  ListOptions,
  ListResult,
} from './execution'
import type { JsonValue } from './json'

/** A real admitted execution, independent of the business objects and any business-specific history. */
export interface TaskRunRef {
  readonly taskRunId: string
}
export const taskRunStatuses = [
  'queued',
  'running',
  'pausing',
  'paused',
  'cancelling',
  'completed',
  'failed',
  'cancelled',
  'interrupted',
] as const
export type TaskRunStatus = (typeof taskRunStatuses)[number]
export type TaskTerminalStatus = 'completed' | 'failed' | 'cancelled' | 'interrupted'
/** Last stored history facts, with UTC millisecond times; unknown start/end times are null and failures can retain legal partial results. */
export interface TaskRun {
  readonly id: string
  readonly type: string
  readonly title: string
  readonly description: string | null
  readonly status: TaskRunStatus
  readonly input: JsonValue | null
  readonly result: JsonValue | null
  readonly error: ErrorSummary | null
  readonly createdAt: number
  readonly startedAt: number | null
  readonly finishedAt: number | null
}
/** Progress is an observation, not proof that the business or history commit is complete. */
export type TaskProgress =
  | { readonly phase: string; readonly completed?: never; readonly total?: never }
  | { readonly phase?: string; readonly completed: number; readonly total: number }
/** Actual execution controls and progress are distinct from durable history and can change without a database write. */
export interface TaskState {
  readonly ref: TaskRunRef
  readonly status: TaskRunStatus
  readonly progress: TaskProgress | null
  readonly canPause: boolean
  readonly canResume: boolean
  readonly canCancel: boolean
}
/** A caller supplies a necessary safe history snapshot, never credentials or a copy of a source response. */
export interface TaskDefinition {
  readonly type: string
  readonly title: string
  readonly description?: string
  readonly input?: JsonValue | null
  readonly pausable?: boolean
  readonly cancellable?: boolean
}
/** The callback owns its business work; checkpoints are used only at actual safe boundaries. */
export interface TaskExecutionContext<Result> extends ExecutionContext {
  readonly ref: TaskRunRef
  /** Respond to pending pause/cancellation at a safe point; cancellation waits for business cleanup. */
  checkpoint(): Promise<void>
  /** Publish actual lightweight progress without rewriting the full result history. */
  reportProgress(progress: TaskProgress): void
  /** Persist an already established legal JSON result at a deliberate business checkpoint. */
  reportResult(result: Result): Promise<void>
}
/** History filters intersect; creation bounds are UTC milliseconds, with an inclusive start and exclusive end. */
export interface TaskQuery {
  readonly types?: readonly string[]
  readonly statuses?: readonly TaskRunStatus[]
  readonly createdFrom?: number
  readonly createdBefore?: number
}
export type TaskSummary = Omit<TaskRun, 'input' | 'result'>
/** Task management never infers business success, replays unknown writes, or owns automatic trigger policy. */
export interface TasksApi {
  /** Register one execution, run the callback, finish task/history cleanup, then return its actual JSON result. */
  run<Result>(
    definition: TaskDefinition,
    execute: (context: TaskExecutionContext<Result>) => Promise<Result>,
    call?: CallOptions,
  ): Promise<Result>
  /** Read bounded summaries and a coherent total using the effective actual/history state. */
  list(query: TaskQuery, options: ListOptions, call?: CallOptions): Promise<ListResult<TaskSummary>>
  /** Read saved details or null. Orphaned nonterminal history projects interrupted without writing a repair. */
  get(ref: TaskRunRef, call?: CallOptions): Promise<TaskRun | null>
  /** Deliver the current lightweight state and subsequent changes; terminal delivery ends observation. */
  observe(ref: TaskRunRef, listener: (state: TaskState) => void): Disposable
  /** Notify that a history snapshot should be reread; high-frequency progress uses observe. */
  onInvalidated(listener: () => void): Disposable
  /** Wait for the actual terminal record; cancelling this wait does not cancel the execution. */
  wait(
    ref: TaskRunRef,
    call?: CallOptions,
  ): Promise<TaskRun & { readonly status: TaskTerminalStatus }>
  /** Request pausing at the next safe checkpoint and return the current resulting state. */
  pause(ref: TaskRunRef, call?: CallOptions): Promise<TaskState>
  /** Resume or withdraw a pending pause; a terminal task stays terminal. */
  resume(ref: TaskRunRef, call?: CallOptions): Promise<TaskState>
  /** Request cancellation; completion is established only by wait or the terminal observation. */
  cancel(ref: TaskRunRef, call?: CallOptions): Promise<TaskState>
  /** Delete only matching ended history and return the actual count, retaining business products and other histories. */
  clearHistory(filter?: { readonly createdBefore?: number }, call?: CallOptions): Promise<number>
}

/** Determine terminal task status without inferring it from a progress percentage or error field. */
export function isTaskTerminal(status: TaskRunStatus): status is TaskTerminalStatus {
  return (
    status === 'completed' ||
    status === 'failed' ||
    status === 'cancelled' ||
    status === 'interrupted'
  )
}
