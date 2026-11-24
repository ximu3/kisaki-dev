import type { NonEmptyArray, ListOptions, CallOptions, ListResult, Disposable } from '../operations'
import type { WorkClues } from '../metadata/fields'
import * as v from 'valibot'
import { parseAbsolutePath, parseRelativePath } from '../paths'
import {
  parseErrorSummary,
  DesktopError,
  parseExecutionFailure,
  type ErrorSummary,
  type ExecutionFailure,
} from '../errors'
import {
  fromParser,
  nonnegativeInteger,
  parseValue,
  unique,
  id,
  text,
  timestamp,
} from '../validation'
import { parseIngestAddResult, type IngestAddResult } from '../ingest/add'
import { isWorkType, type WorkType } from '../library/catalog'
import {
  parseLocalContentRegistrationResult,
  type LocalContentRegistrationResult,
} from '../library/holdings/local-content'
import { clues } from './recognizers'
import { parseScanConfigSnapshot, type ScanConfigSnapshot } from './configs'

export type ScanScope =
  | { readonly type: 'full' }
  | { readonly type: 'incremental'; readonly paths: NonEmptyArray<string> }

export interface ScanDiscovery {
  readonly finished: boolean
  readonly candidateCount: number
  readonly issues: readonly { readonly path: string; readonly error: ErrorSummary }[]
}

export type ScanLocalContentResult<T extends WorkType = WorkType> =
  | { readonly status: 'included' }
  | { readonly status: 'skipped' }
  | { readonly status: 'registered'; readonly result: LocalContentRegistrationResult<T> }
  | {
      readonly status: 'failed'
      readonly error: ExecutionFailure<LocalContentRegistrationResult<T>>
    }
  | { readonly status: 'notStarted' }

export type ScanCandidateResult<T extends WorkType = WorkType> = {
  [K in T]: { readonly path: string; readonly clues: WorkClues | null } & (
    | { readonly result: IngestAddResult<K>; readonly localContent: ScanLocalContentResult<K> }
    | { readonly error: ExecutionFailure<IngestAddResult<K>> }
  )
}[T]

export interface ScanResult<T extends WorkType = WorkType> {
  readonly discovery: ScanDiscovery
  readonly candidates: readonly ScanCandidateResult<T>[]
}

export type ScanRunStatus = 'active' | 'completed' | 'failed' | 'cancelled' | 'interrupted'

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

    readonly createdAt: number
    readonly startedAt: number | null
    readonly finishedAt: number | null
  }
}[T]

export type ScanRunSummary = Omit<ScanRun, 'configSnapshot' | 'result'>

export interface ScanRunQuery {
  readonly scanConfigId?: string
  readonly statuses?: readonly ScanRunStatus[]
  readonly createdFrom?: number
  readonly createdBefore?: number
}

export interface ScanRunsApi {
  list(
    query: ScanRunQuery,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<ScanRunSummary>>

  get(runId: string, call?: CallOptions): Promise<ScanRun | null>

  clear(
    filter?: {
      readonly scanConfigId?: string
      readonly createdBefore?: number
    },
    call?: CallOptions,
  ): Promise<number>

  onInvalidated(listener: () => void): Disposable
}

export const path = fromParser(parseAbsolutePath)

export const error = fromParser(parseErrorSummary)

export const discovery = v.strictObject({
  finished: v.boolean(),
  candidateCount: nonnegativeInteger,
  issues: v.array(v.strictObject({ path, error })),
})

const statuses = ['active', 'completed', 'failed', 'cancelled', 'interrupted'] as const

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
    result: fromParser(parseLocalContentRegistrationResult),
  }),
  v.strictObject({
    status: v.literal('failed'),
    error: fromParser((value) => parseExecutionFailure(value, parseLocalContentRegistrationResult)),
  }),
])

function parseScanCandidateResult(input: unknown): ScanCandidateResult {
  const value = parseValue(
    v.union([
      v.strictObject({
        path,
        clues: v.nullable(clues),
        result: fromParser(parseWorkAddResult),
        localContent,
      }),
      v.strictObject({
        path,
        clues: v.nullable(clues),
        error: fromParser((value) => parseExecutionFailure(value, parseWorkAddResult)),
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

export function parseScanResult(input: unknown): ScanResult {
  const value = parseValue(
    v.strictObject({
      discovery,
      candidates: v.pipe(
        v.array(fromParser(parseScanCandidateResult)),
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

export function parseScanScope(input: unknown): ScanScope {
  const relative = fromParser(parseRelativePath)
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
  return parseValue(scope, input, 'Invalid scan scope')
}

export function parseScanRun(input: unknown): ScanRun {
  const value = parseValue(
    v.strictObject({
      id,
      scanConfigId: id,
      configSnapshot: fromParser(parseScanConfigSnapshot),
      scope: fromParser(parseScanScope),
      description: v.nullable(text),
      status: v.picklist(statuses),
      result: v.nullable(fromParser(parseScanResult)),
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
