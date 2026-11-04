/** @fileoverview Defines scan execution reports and validates complete discovery and candidate accounting. */

import type { NonEmptyArray, ListOptions, CallOptions, ListResult, Disposable } from '../operations'
import type { ErrorSummary, ExecutionFailure } from '../errors'
import type { LocalContentRegistrationResult } from '../library/holdings/local-content'
import type { WorkClues } from '../metadata/fields'
import type { AddResult } from '../ingest/add'
import type { WorkType } from '../library/catalog'
import type { ScanConfigSnapshot } from './configs'
import * as v from 'valibot'
import { parseAbsolutePath, parseRelativePath } from '../paths'
import { parseErrorSummary, DesktopError, parseExecutionFailure } from '../errors'
import { nonnegativeInteger, parseValue, unique, id, text, timestamp } from '../validation'
import { parseAddResult } from '../ingest/add'
import { isWorkType } from '../library/catalog'
import { parseLocalContentRegistrationResult } from '../library/holdings/local-content'
import { clues } from './recognizers'
import { parseScanConfigSnapshot } from './configs'

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

/** Report cleanup removes finished scan history only and never cascades to tasks, configurations, entries or local files. */
export interface ScanRunsApi {
  list(
    query: ScanRunQuery,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<ScanRunSummary>>
  get(runId: string, call?: CallOptions): Promise<ScanRun | null>

  clear(
    filter?: { readonly scanConfigId?: string; readonly createdBefore?: number },
    call?: CallOptions,
  ): Promise<number>

  onInvalidated(listener: () => void): Disposable
}

export const path = v.pipe(v.unknown(), v.transform(parseAbsolutePath))

export const error = v.pipe(v.unknown(), v.transform(parseErrorSummary))

export const discovery = v.strictObject({
  finished: v.boolean(),
  candidateCount: nonnegativeInteger,
  issues: v.array(v.strictObject({ path, error })),
})

const statuses = ['active', 'completed', 'failed', 'cancelled', 'interrupted'] as const

function workAddResult(input: unknown): AddResult<WorkType> {
  const value = parseAddResult(input)
  if (!isWorkType(value.entry.type)) {
    throw new DesktopError('InvalidInput', 'Scanner candidates must resolve to a work')
  }

  return value as AddResult<WorkType>
}

const localContent = v.variant('status', [
  v.strictObject({ status: v.literal('included') }),
  v.strictObject({ status: v.literal('skipped') }),
  v.strictObject({ status: v.literal('notStarted') }),
  v.strictObject({
    status: v.literal('registered'),
    result: v.pipe(v.unknown(), v.transform(parseLocalContentRegistrationResult)),
  }),
  v.strictObject({
    status: v.literal('failed'),
    error: v.pipe(
      v.unknown(),
      v.transform((value) => parseExecutionFailure(value, parseLocalContentRegistrationResult)),
    ),
  }),
])

function candidate(input: unknown): ScanCandidateResult {
  const value = parseValue(
    v.union([
      v.strictObject({
        path,
        clues: v.nullable(clues),
        result: v.pipe(v.unknown(), v.transform(workAddResult)),
        localContent,
      }),
      v.strictObject({
        path,
        clues: v.nullable(clues),
        error: v.pipe(
          v.unknown(),
          v.transform((value) => parseExecutionFailure(value, workAddResult)),
        ),
      }),
    ]),
    input,
    'Invalid scan candidate report',
  )
  if ('result' in value) {
    if ((value.result.outcome === 'added') !== (value.localContent.status === 'included')) {
      throw new DesktopError('InvalidInput', 'Scan local-content outcome contradicts root adoption')
    }

    let registration
    if (value.localContent.status === 'registered') {
      registration = value.localContent.result
    } else if (value.localContent.status === 'failed') {
      registration = value.localContent.error.partialResult
    }
    if (
      registration &&
      (registration.work.type !== value.result.entry.type ||
        registration.work.id !== value.result.entry.id)
    ) {
      throw new DesktopError(
        'InvalidInput',
        'Local content was registered for a different scan work',
      )
    }
  }
  return value
}

/** Reports retain discovered versus handled counts; unstarted candidates never become fabricated failures. */
export function parseScanResult(input: unknown): ScanResult {
  const value = parseValue(
    v.strictObject({
      discovery,
      candidates: v.pipe(
        v.array(v.pipe(v.unknown(), v.transform(candidate))),
        v.check((candidates) => unique(candidates, (item) => item.path)),
      ),
    }),
    input,
    'Invalid scan result',
  )
  if (value.candidates.length > value.discovery.candidateCount) {
    throw new DesktopError(
      'InvalidInput',
      'A scan report cannot handle more candidates than it discovered',
    )
  }

  return value
}

/** Require completed discovery and a report for every discovered candidate before declaring the scan complete. */
export function requireCompleteScanResult(result: ScanResult | null): ScanResult {
  if (
    !result ||
    !result.discovery.finished ||
    result.candidates.length !== result.discovery.candidateCount ||
    result.candidates.some((item) => 'result' in item && item.localContent.status === 'notStarted')
  ) {
    throw new DesktopError('InvalidInput', 'Completed scan contains uncompleted work')
  }

  return result
}

/** Validate independent persisted scan history; completed reports must finish discovery and report every discovered candidate. */
export function parseScanRun(input: unknown): ScanRun {
  const relative = v.pipe(v.unknown(), v.transform(parseRelativePath))
  const scope = v.union([
    v.strictObject({ type: v.literal('full') }),
    v.strictObject({
      type: v.literal('incremental'),
      paths: v.pipe(
        v.tupleWithRest([relative], relative),
        v.check((paths) => unique(paths, (path) => path)),
      ),
    }),
  ])
  const value = parseValue(
    v.strictObject({
      id,
      scanConfigId: id,
      configSnapshot: v.pipe(v.unknown(), v.transform(parseScanConfigSnapshot)),
      scope,
      description: v.nullable(text),
      status: v.picklist(statuses),
      result: v.nullable(v.pipe(v.unknown(), v.transform(parseScanResult))),
      error: v.nullable(error),
      createdAt: timestamp,
      startedAt: v.nullable(timestamp),
      finishedAt: v.nullable(timestamp),
    }),
    input,
    'Invalid scan history',
  )
  if (value.status === 'completed') {
    requireCompleteScanResult(value.result)
  }
  return value
}

/** Historical list filters do not load full reports; creation bounds use [from, before). */
export function parseScanRunQuery(input: unknown): ScanRunQuery {
  return parseValue(
    v.pipe(
      v.strictObject({
        scanConfigId: v.exactOptional(id),
        statuses: v.exactOptional(
          v.pipe(
            v.array(v.picklist(statuses)),
            v.check((values) => unique(values, (value) => value)),
          ),
        ),
        createdFrom: v.exactOptional(timestamp),
        createdBefore: v.exactOptional(timestamp),
      }),
      v.check(
        (value) =>
          value.createdFrom === undefined ||
          value.createdBefore === undefined ||
          value.createdFrom < value.createdBefore,
      ),
    ),
    input,
    'Invalid scan history query',
  )
}
