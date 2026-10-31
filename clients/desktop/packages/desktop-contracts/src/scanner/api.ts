/** @fileoverview Defines actual scan reports, their independent history, and configuration-bound runtime observation. */

import type { ErrorSummary, ExecutionFailure } from '../errors'
import type { CallOptions, Disposable, ListOptions, ListResult } from '../execution'
import type { AddResult } from '../ingest/api'
import type { LocalContentRegistrationResult } from '../library/holdings'
import type { WorkType } from '../library/identity'
import type { WorkClues } from '../metadata/identification'
import type { MetadataProfileDefinition } from '../metadata/profiles'
import type { TaskRunRef } from '../tasks'
import type { NamedCaptures } from '../text-rules'
import type { ScanConfigsApi, ScanDefinition } from './configs'
import type { WorkRecognizersApi } from './recognizers'

/** Traversal completion and complete readability differ; candidateCount counts only actual discoveries so far. */
export interface ScanDiscovery {
  readonly finished: boolean
  readonly candidateCount: number
  readonly issues: readonly { readonly path: string; readonly error: ErrorSummary }[]
}
/** Reusing an existing entry does not imply that local content was registered; report that independent step explicitly. */
export type ExistingContentOutcome =
  | { readonly status: 'skipped' | 'notStarted' }
  | { readonly status: 'registered'; readonly result: LocalContentRegistrationResult }
  | { readonly status: 'failed'; readonly error: ExecutionFailure<LocalContentRegistrationResult> }
export type ScanCandidateResult = { readonly path: string; readonly clues: WorkClues | null } & (
  | {
      readonly result: Extract<AddResult<WorkType>, { outcome: 'added' }>
      readonly localContent: { readonly status: 'included' }
    }
  | {
      readonly result: Extract<AddResult<WorkType>, { outcome: 'alreadyExists' }>
      readonly localContent: ExistingContentOutcome
    }
  | { readonly error: ExecutionFailure<AddResult<WorkType>> }
)
/** Only processed candidates appear. Unstarted candidates never become invented failures after cancellation. */
export interface ScanResult {
  readonly discovery: ScanDiscovery
  readonly candidates: readonly ScanCandidateResult[]
}
/** The current watch and admitted task are independent; stopping a watch does not end an already admitted scan. */
export interface ScannerState {
  readonly watch: {
    readonly status: 'disabled' | 'starting' | 'active' | 'unavailable'
    readonly error: ErrorSummary | null
  }
  readonly currentRun: { readonly scanRunId: string; readonly taskRef: TaskRunRef } | null
}
/** A run uses the admitted profile and configuration snapshot, independently of later edits or deletion. */
export interface ScanConfigSnapshot {
  readonly name: string
  readonly workType: WorkType
  readonly rootPath: string
  readonly definition: ScanDefinition
  readonly registerExistingContent: boolean
  readonly metadataProfile: {
    readonly id: string
    readonly name: string
    readonly entryType: WorkType
    readonly preferredLanguages: readonly string[]
    readonly definition: MetadataProfileDefinition<WorkType>
  }
}
export type ScanScope =
  { readonly type: 'config' } | { readonly type: 'watch'; readonly paths: readonly string[] }
export type ScanRunStatus = 'active' | 'completed' | 'failed' | 'cancelled' | 'interrupted'
/** Last saved scan history, independent from TaskRun; times are UTC milliseconds and unknown values remain null. */
export interface ScanRun {
  readonly id: string
  readonly scanConfigId: string
  readonly configSnapshot: ScanConfigSnapshot
  readonly scope: ScanScope
  readonly description: string | null
  readonly status: ScanRunStatus
  readonly result: ScanResult | null
  readonly error: ErrorSummary | null
  readonly createdAt: number
  readonly startedAt: number | null
  readonly finishedAt: number | null
}
export type ScanRunSummary = Omit<ScanRun, 'configSnapshot' | 'result'>
/** Scan history filters intersect, with inclusive createdFrom and exclusive createdBefore in UTC milliseconds. */
export interface ScanRunQuery {
  readonly scanConfigId?: string
  readonly statuses?: readonly ScanRunStatus[]
  readonly createdFrom?: number
  readonly createdBefore?: number
}
export interface ScanRunsApi {
  /** Read bounded summaries and a matching total in descending creation/ID order. */
  list(
    query: ScanRunQuery,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<ScanRunSummary>>
  /** Read one complete saved report or null; task history and current configuration are not prerequisites. */
  get(runId: string, call?: CallOptions): Promise<ScanRun | null>
  /** Delete only matching ended scan history and return the actual count; neither task history nor formal products are removed. */
  clear(
    filter?: { readonly scanConfigId?: string; readonly createdBefore?: number },
    call?: CallOptions,
  ): Promise<number>
  /** Notify that saved history should be reread; live progress belongs to the associated task. */
  onInvalidated(listener: () => void): Disposable
}
export interface ScanPreviewInput {
  readonly workType: WorkType
  readonly rootPath: string
  readonly definition: ScanDefinition
}
export interface ScanPreviewItem {
  readonly path: string
  readonly relativePath: string
  readonly kind: 'directory' | 'file'
  readonly outcome: 'candidate' | 'filtered' | 'notCandidate' | 'failed'
  readonly inputText: string | null
  readonly matchedRuleId: string | null
  readonly captures: NamedCaptures
  readonly clues: WorkClues | null
  readonly error: ErrorSummary | null
}
export interface ScanPreviewResult {
  readonly discovery: ScanDiscovery
  readonly items: readonly ScanPreviewItem[]
}
export type ScanFinishedEvent = {
  readonly scanRunId: string
  readonly scanConfigId: string
  readonly finishedAt: number
} & (
  | { readonly status: 'completed'; readonly result: ScanResult }
  | {
      readonly status: 'failed' | 'cancelled' | 'interrupted'
      readonly error: ErrorSummary
      readonly result?: ScanResult
    }
)
export interface ScannerApi {
  readonly configs: ScanConfigsApi
  readonly recognizers: WorkRecognizersApi
  readonly runs: ScanRunsApi
  /** Preview the exact draft's discovery and clue interpretation, without source acquisition, adoption, or watching. */
  preview(input: ScanPreviewInput, call?: CallOptions): Promise<ScanPreviewResult>
  /** Execute the current complete configuration, returning its business report after task cleanup; an already active scan is Busy. */
  scan(configId: string, call?: CallOptions): Promise<ScanResult>
  /** Read actual watch/run state while either the configuration or its admitted execution still exists. */
  getState(configId: string, call?: CallOptions): Promise<ScannerState | null>
  /** Deliver current state then changes without a read gap; final null ends observation, disposal only stops delivery. */
  observe(configId: string, listener: (state: ScannerState | null) => void): Disposable
}
