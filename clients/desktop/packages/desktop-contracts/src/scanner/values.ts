/** @fileoverview Defines scanner configuration, source-clue participation, actual scan reports and independent history. */

import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { ErrorSummary, ExecutionFailure } from '../errors'
import type { NonEmptyArray, ExecutionContext, StoredDefinition } from '../operations'
import type { PathFilter } from '../paths'
import type { WorkType } from '../library/catalog'
import type { LocalContentRegistrationResult } from '../library/holdings-values'
import type { AddResult } from '../ingest/values'
import type { WorkClues } from '../metadata/fields'
import type { MetadataProfileSnapshot } from '../metadata/profiles'
import type { TaskRunRef } from '../tasks'

/** Templates only target root-work clues; no file rename, local ID, private provider setting or arbitrary object path is permitted. */
export interface ClueExtractionOutput {
  readonly name?: string
  readonly originalName?: string
  readonly releaseDate?: { readonly year?: string; readonly month?: string; readonly day?: string }
  readonly externalIdentities?: NonEmptyArray<{
    readonly source: string
    readonly sourceId: string
  }>
}

export interface ClueExtractionRule {
  readonly id: string
  readonly name: string
  readonly enabled: boolean

  readonly input: 'baseName' | 'relativePath'
  readonly pattern: string
  readonly ignoreCase: boolean

  readonly output: ClueExtractionOutput
}

/** The candidate's boundary and type are already determined; every recognizer receives the same original clues. */
export interface RecognitionInput {
  readonly entryType: WorkType
  readonly path: string
  readonly kind: 'directory' | 'file'
  readonly clues: WorkClues
}

export interface WorkRecognizer {
  readonly name: LocalizedText
  readonly description?: LocalizedText
  readonly workTypes: NonEmptyArray<WorkType>

  /** Return actual new clues or null; never a candidate list, empty object or a copy of the input. */
  recognize(input: RecognitionInput, context: ExecutionContext): Promise<WorkClues | null>
}

export interface WorkRecognizerDescriptor {
  readonly id: string
  readonly name: LocalizedText
  readonly description?: LocalizedText
  readonly workTypes: NonEmptyArray<WorkType>
}

/** Candidate discovery and clue extraction remain separate from holdings' existing-part matching. */
export interface ScanDefinition {
  readonly entryDepth: number
  readonly inputKinds: NonEmptyArray<'directory' | 'file'>
  readonly include: readonly PathFilter[]
  readonly exclude: readonly PathFilter[]

  readonly identification: {
    readonly rules: readonly ClueExtractionRule[]
    readonly recognizerIds: readonly string[]
  }
}

export interface ScanConfigFields {
  readonly name: string
  readonly rootPath: string
  readonly metadataProfileId: string
  readonly definition: ScanDefinition
  readonly registerExistingContent: boolean
  readonly watchEnabled: boolean
}

export interface ScanConfig {
  readonly id: string
  readonly name: string
  readonly workType: WorkType
  readonly rootPath: string
  readonly metadataProfileId: string
  readonly definition: StoredDefinition<ScanDefinition>
  readonly registerExistingContent: boolean
  readonly watchEnabled: boolean

  readonly sortOrder: number

  readonly createdAt: number
  readonly updatedAt: number
}

export interface ScanConfigCreate {
  readonly name: string
  readonly workType: WorkType
  readonly rootPath: string
  readonly metadataProfileId: string
  readonly definition: ScanDefinition
  readonly registerExistingContent?: boolean
  readonly watchEnabled?: boolean
}

export interface ScanConfigUpdate {
  readonly changes: Partial<ScanConfigFields>
  readonly expected?: Partial<ScanConfigFields>
}

export interface ScanConfigSnapshot {
  readonly name: string
  readonly workType: WorkType
  readonly rootPath: string
  readonly definition: ScanDefinition
  readonly registerExistingContent: boolean
  readonly metadataProfile: MetadataProfileSnapshot<WorkType>
}

/** Only watcher-owned internal runs may describe incremental coverage; public scan always uses the full current config. */
export type ScanScope =
  | { readonly type: 'full' }
  | { readonly type: 'incremental'; readonly paths: NonEmptyArray<string> }

export interface ScanDiscovery {
  readonly finished: boolean
  readonly candidateCount: number
  readonly issues: readonly { readonly path: string; readonly error: ErrorSummary }[]
}

export type ScanLocalContentResult =
  | { readonly status: 'included' }
  | { readonly status: 'skipped' }
  | { readonly status: 'registered'; readonly result: LocalContentRegistrationResult }
  | { readonly status: 'failed'; readonly error: ExecutionFailure<LocalContentRegistrationResult> }
  | { readonly status: 'notStarted' }

/** Already-created roots retain their own result, even if a later existing-content registration fails. */
export type ScanCandidateResult = { readonly path: string; readonly clues: WorkClues | null } & (
  | { readonly result: AddResult<WorkType>; readonly localContent: ScanLocalContentResult }
  | { readonly error: ExecutionFailure<AddResult<WorkType>> }
)

export interface ScanResult {
  readonly discovery: ScanDiscovery
  readonly candidates: readonly ScanCandidateResult[]
}

export type ScanRunStatus = 'active' | 'completed' | 'failed' | 'cancelled' | 'interrupted'

/** Scan reports survive configuration/task-history deletion and preserve the exact scope/profile snapshot used at admission. */
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

export interface ScanRunQuery {
  readonly scanConfigId?: string
  readonly statuses?: readonly ScanRunStatus[]
  readonly createdFrom?: number
  readonly createdBefore?: number
}

/** Watch availability and managed work are separate. Removing a config does not end an already accepted currentRun. */
export interface ScannerState {
  readonly watch:
    | { readonly status: 'disabled' | 'starting' | 'active'; readonly error: null }
    | { readonly status: 'unavailable'; readonly error: ErrorSummary }
  readonly currentRun: { readonly scanRunId: string; readonly taskRef: TaskRunRef } | null
}

export interface ClueExtractionResult {
  readonly clues: WorkClues
  readonly ruleId: string | null
  readonly captures: Readonly<Record<string, string>>
}

export interface ScanPreviewInput {
  readonly workType: WorkType
  readonly rootPath: string
  readonly definition: ScanDefinition
}

export type ScanPreviewPath = {
  readonly path: string
  readonly relativePath: string
  readonly kind: 'directory' | 'file'
} & (
  | { readonly outcome: 'excluded'; readonly filter: PathFilter }
  | {
      readonly outcome: 'candidate'
      readonly baseName: string
      readonly extraction: ClueExtractionResult
    }
  | { readonly outcome: 'failed'; readonly error: ErrorSummary }
)

/** Read-only discovery and native extraction, without remote metadata acquisition or a selectable adoption plan. */
export interface ScanPreviewResult {
  readonly discovery: ScanDiscovery
  readonly paths: readonly ScanPreviewPath[]
}

export interface ClueExtractionPreset {
  readonly id: string
  readonly name: LocalizedText
  readonly description: LocalizedText
  readonly rule: Omit<ClueExtractionRule, 'id' | 'name'>
}
