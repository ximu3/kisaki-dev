/** @fileoverview Defines scan execution reports and validates complete discovery and candidate accounting. */

import type { NonEmptyArray, ListOptions, CallOptions, ListResult, Disposable } from '../operations'
import type { ErrorSummary, ExecutionFailure } from '../errors'
import type { LocalContentRegistrationResult } from '../library/holdings/local-content'
import type { WorkClues } from '../metadata/fields'
import type { IngestAddResult } from '../ingest/add'
import type { WorkType } from '../library/catalog'
import type { ScanConfigSnapshot } from './configs'
import * as v from 'valibot'
import { parseAbsolutePath, parseRelativePath } from '../paths'
import { parseErrorSummary, DesktopError, parseExecutionFailure } from '../errors'
import { nonnegativeInteger, parseValue, unique, id, text, timestamp } from '../validation'
import { parseIngestAddResult } from '../ingest/add'
import { isWorkType } from '../library/catalog'
import { parseLocalContentRegistrationResult } from '../library/holdings/local-content'
import { clues } from './recognizers'
import { parseScanConfigSnapshot } from './configs'

/**
 * Coverage captured for one scan run.
 *
 * Public scan uses the full current configuration; only internal watcher runs may use incremental
 * relative paths.
 */
export type ScanScope =
  | { readonly type: 'full' }
  | { readonly type: 'incremental'; readonly paths: NonEmptyArray<string> }

/** Discovery completion, number of candidates found and path-specific traversal issues. */
export interface ScanDiscovery {
  readonly finished: boolean
  readonly candidateCount: number
  readonly issues: readonly { readonly path: string; readonly error: ErrorSummary }[]
}

/**
 * Candidate local-content outcome, including registration failures with retained partial results.
 */
export type ScanLocalContentResult<T extends WorkType = WorkType> =
  | { readonly status: 'included' }
  | { readonly status: 'skipped' }
  | { readonly status: 'registered'; readonly result: LocalContentRegistrationResult<T> }
  | {
      readonly status: 'failed'
      readonly error: ExecutionFailure<LocalContentRegistrationResult<T>>
    }
  | { readonly status: 'notStarted' }

/**
 * One candidate's clues and adoption result or failure.
 *
 * Established root outcomes remain available when subsequent existing-content registration fails.
 */
export type ScanCandidateResult<T extends WorkType = WorkType> = {
  [K in T]: { readonly path: string; readonly clues: WorkClues | null } & (
    | { readonly result: IngestAddResult<K>; readonly localContent: ScanLocalContentResult<K> }
    | { readonly error: ExecutionFailure<IngestAddResult<K>> }
  )
}[T]

/** Discovery progress and outcomes for candidates actually handled during a scan. */
export interface ScanResult<T extends WorkType = WorkType> {
  readonly discovery: ScanDiscovery
  readonly candidates: readonly ScanCandidateResult<T>[]
}

/** Persisted scan lifecycle state, including cancellation and interruption. */
export type ScanRunStatus = 'active' | 'completed' | 'failed' | 'cancelled' | 'interrupted'

/**
 * Persisted scan report with the scope and configuration snapshot fixed at admission.
 *
 * Reports survive deletion of their configuration or associated task history.
 */
export type ScanRun<T extends WorkType = WorkType> = {
  [K in T]: {
    readonly id: string
    readonly scanConfigId: string
    readonly configSnapshot: ScanConfigSnapshot<K>
    readonly scope: ScanScope
    readonly description: string | null

    readonly status: ScanRunStatus
    readonly result: ScanResult<K> | null
    readonly error: ErrorSummary | null

    /** UTC milliseconds since the Unix epoch. */
    readonly createdAt: number
    /** UTC milliseconds since the Unix epoch. */
    readonly startedAt: number | null
    /** UTC milliseconds since the Unix epoch. */
    readonly finishedAt: number | null
  }
}[T]

/** Scan-history projection omitting the full captured configuration and candidate report. */
export type ScanRunSummary = Omit<ScanRun, 'configSnapshot' | 'result'>

/** Scan-history filters for configuration, lifecycle state and creation interval. */
export interface ScanRunQuery {
  readonly scanConfigId?: string
  readonly statuses?: readonly ScanRunStatus[]
  /** Inclusive creation-time lower bound in UTC milliseconds since the Unix epoch. */
  readonly createdFrom?: number
  /** Exclusive creation-time upper bound in UTC milliseconds since the Unix epoch. */
  readonly createdBefore?: number
}

/** Independent scan-history reads, finished-report cleanup and invalidation. */
export interface ScanRunsApi {
  /** Reads an interval of persisted scan-report summaries matching the query. */
  list(
    query: ScanRunQuery,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<ScanRunSummary>>

  /** Reads a stored report and its configuration snapshot, returning null when absent. */
  get(runId: string, call?: CallOptions): Promise<ScanRun | null>

  /**
   * Removes matching finished reports and returns the count.
   *
   * Tasks, configurations, library data and files retain their own lifetimes.
   */
  clear(
    filter?: {
      readonly scanConfigId?: string
      /** Exclusive creation-time upper bound in UTC milliseconds since the Unix epoch. */
      readonly createdBefore?: number
    },
    call?: CallOptions,
  ): Promise<number>

  /**
   * Subscribes to scan-history invalidation and returns the subscription lifetime.
   *
   * Callers subscribe before reading. Live scan progress uses task observation.
   */
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

/** Parses an ingest result and requires its root to be a work. */
function parseWorkAddResult(input: unknown): IngestAddResult<WorkType> {
  const value = parseIngestAddResult(input)
  if (!isWorkType(value.entry.type)) {
    throw new DesktopError('InvalidInput', 'Scanner candidates must resolve to a work')
  }

  return value as IngestAddResult<WorkType>
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

/**
 * Parses a candidate outcome and checks local-content status and work identity against root
 * adoption.
 */
function parseScanCandidateResult(input: unknown): ScanCandidateResult {
  const value = parseValue(
    v.union([
      v.strictObject({
        path,
        clues: v.nullable(clues),
        result: v.pipe(v.unknown(), v.transform(parseWorkAddResult)),
        localContent,
      }),
      v.strictObject({
        path,
        clues: v.nullable(clues),
        error: v.pipe(
          v.unknown(),
          v.transform((value) => parseExecutionFailure(value, parseWorkAddResult)),
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
  return value as ScanCandidateResult
}

/**
 * Parses distinct candidate reports and checks that handled candidates do not exceed the discovered
 * count.
 *
 * Unstarted candidates remain outside the handled report list.
 */
export function parseScanResult(input: unknown): ScanResult {
  const value = parseValue(
    v.strictObject({
      discovery,
      candidates: v.pipe(
        v.array(v.pipe(v.unknown(), v.transform(parseScanCandidateResult))),
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

/**
 * Requires finished discovery and an outcome for every candidate, with no unstarted local-content
 * step.
 */
export function requireCompleteScanResult<T extends WorkType>(
  result: ScanResult<T> | null,
): ScanResult<T> {
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

/** Parses same-medium scan history and requires completed runs to account for all discovered work. */
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
  for (const candidate of value.result?.candidates ?? []) {
    const result = 'result' in candidate ? candidate.result : candidate.error.partialResult
    if (result && result.entry.type !== value.configSnapshot.workType) {
      throw new DesktopError('InvalidInput', 'Scan result does not match the captured work type')
    }
  }

  if (value.status === 'completed') {
    requireCompleteScanResult(value.result)
  }
  return value as ScanRun
}

/**
 * Parses history filters with a strictly ordered, half-open creation-time interval when both bounds
 * are present.
 */
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
