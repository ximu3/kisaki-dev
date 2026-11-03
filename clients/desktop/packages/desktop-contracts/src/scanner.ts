/** @fileoverview Exposes scanner configuration, bounded rule preparation, real execution reports and independent observation. */

import * as v from 'valibot'
import { DesktopError, parseErrorSummary, parseExecutionFailure } from './errors'
import type {
  CallOptions,
  Disposable,
  ListOptions,
  ListResult,
  Listener,
  NonEmptyArray,
  Registration,
} from './operations'
import { parseAbsolutePath, parsePathFilter, parseRelativePath } from './paths'
import {
  id,
  nonemptyText,
  nonnegativeInteger,
  optionalFields,
  parseValue,
  positiveInteger,
  text,
  timestamp,
  unique,
  validateExpectedKeys,
} from './validation'
import { isWorkType, languageSchema, workTypes } from './library/catalog'
import type { WorkType } from './library/catalog'
import { parseLocalContentRegistrationResult } from './library/holdings'
import type { ReorderInput } from './library/ordering'
import { parseAddResult } from './ingest'
import type { AddResult } from './ingest/values'
import { hasNewWorkClues, parseIdentificationClues } from './metadata/fields'
import type { WorkClues } from './metadata/fields'
import { parseMetadataProfileDefinition } from './metadata/profiles'
import { parseTaskRunRef } from './tasks'
import { parseClueExtractionRule, parseClueExtractionRuleShape } from './scanner/rules'
import type {
  ClueExtractionPreset,
  RecognitionInput,
  ScanCandidateResult,
  ScanConfig,
  ScanConfigCreate,
  ScanConfigSnapshot,
  ScanConfigUpdate,
  ScanDefinition,
  ScanPreviewInput,
  ScanPreviewResult,
  ScanResult,
  ScanRun,
  ScanRunQuery,
  ScanRunSummary,
  ScannerState,
  WorkRecognizer,
  WorkRecognizerDescriptor,
} from './scanner/values'

export type * from './scanner/values'
export {
  expandClueExtractionOutput,
  extractWorkClues,
  getClueExtractionPresets,
  parseClueExtractionRule,
  parseClueExtractionRuleShape,
} from './scanner/rules'
export type { PathFilter } from './paths'

/** Configuration summaries omit complete definitions. Ordinary creation/updates own later watch/initial-scan work separately. */
export interface ScanConfigsApi {
  list(
    filter?: { readonly workType?: WorkType },
    call?: CallOptions,
  ): Promise<readonly Omit<ScanConfig, 'definition'>[]>
  get(id: string, call?: CallOptions): Promise<ScanConfig | null>

  create(input: ScanConfigCreate, call?: CallOptions): Promise<ScanConfig>
  update(id: string, input: ScanConfigUpdate, call?: CallOptions): Promise<ScanConfig>
  delete(id: string, call?: CallOptions): Promise<void>

  reorder(input: ReorderInput, call?: CallOptions): Promise<void>

  listRulePresets(call?: CallOptions): Promise<readonly ClueExtractionPreset[]>

  onInvalidated(listener: () => void): Disposable
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

export interface WorkRecognizersApi {
  list(call?: CallOptions): Promise<readonly WorkRecognizerDescriptor[]>
  get(id: string, call?: CallOptions): Promise<WorkRecognizerDescriptor | null>

  register(
    recognizerId: string,
    implementation: WorkRecognizer,
    call?: CallOptions,
  ): Promise<Registration<string>>
}

/** Public scan is always full-config execution. Progress/control use the one actual taskRef exposed in currentRun. */
export interface ScannerApi {
  readonly configs: ScanConfigsApi
  readonly runs: ScanRunsApi
  readonly recognizers: WorkRecognizersApi

  preview(input: ScanPreviewInput, call?: CallOptions): Promise<ScanPreviewResult>
  scan(configId: string, call?: CallOptions): Promise<ScanResult>

  getState(configId: string, call?: CallOptions): Promise<ScannerState | null>
  observe(
    configId: string,
    listener: Listener<ScannerState | null>,
    call?: CallOptions,
  ): Promise<Disposable>
}

const path = v.pipe(v.unknown(), v.transform(parseAbsolutePath))
const error = v.pipe(v.unknown(), v.transform(parseErrorSummary))

const clues = v.pipe(
  v.unknown(),
  v.transform((value) => parseIdentificationClues('game', value)),
)

const statuses = ['active', 'completed', 'failed', 'cancelled', 'interrupted'] as const

function definitionSchema(parseRule: typeof parseClueExtractionRuleShape) {
  const kind = v.picklist(['directory', 'file'])
  return v.strictObject({
    entryDepth: positiveInteger,
    inputKinds: v.pipe(
      v.tupleWithRest([kind], kind),
      v.check((kinds) => unique(kinds, (kind) => kind)),
    ),
    include: v.array(v.pipe(v.unknown(), v.transform(parsePathFilter))),
    exclude: v.array(v.pipe(v.unknown(), v.transform(parsePathFilter))),

    identification: v.strictObject({
      rules: v.pipe(
        v.array(v.pipe(v.unknown(), v.transform(parseRule))),
        v.check((rules) => unique(rules, (rule) => rule.id)),
      ),
      recognizerIds: v.pipe(
        v.array(id),
        v.check((ids) => unique(ids, (value) => value)),
      ),
    }),
  })
}

/** Default depth/filter/rule values require the caller's explicit input-kind choice; presets are never auto-enabled. */
export function getScanDefinitionDefaults(
  inputKinds: NonEmptyArray<'directory' | 'file'>,
): ScanDefinition {
  return parseScanDefinitionShape({
    entryDepth: 1,
    inputKinds,
    include: [],
    exclude: [],
    identification: { rules: [], recognizerIds: [] },
  })
}

/** Decode closed definition values without compiling user regexes; appropriate for stored snapshots and synchronous codecs. */
export function parseScanDefinitionShape(input: unknown): ScanDefinition {
  return parseValue(
    definitionSchema(parseClueExtractionRuleShape),
    input,
    'Invalid scanner definition shape',
  )
}

/** Full save/execution validation, including disabled patterns and capture references, must run in a terminable bounded unit. */
export function parseScanDefinition(input: unknown): ScanDefinition {
  return parseValue(definitionSchema(parseClueExtractionRule), input, 'Invalid scanner definition')
}

/** Validate a new configuration; actual same-type profile existence and path accessibility are checked by its owner. */
export function parseScanConfigCreate(input: unknown): ScanConfigCreate {
  return parseValue(
    v.strictObject({
      name: nonemptyText,
      workType: v.picklist(workTypes),
      rootPath: path,
      metadataProfileId: id,
      definition: v.pipe(v.unknown(), v.transform(parseScanDefinition)),
      registerExistingContent: v.exactOptional(v.boolean()),
      watchEnabled: v.exactOptional(v.boolean()),
    }),
    input,
    'Invalid scan configuration creation',
  )
}

/** Ordinary editing cannot change workType or technical ordering/timestamps; a submitted definition is one save unit. */
export function parseScanConfigUpdate(input: unknown): ScanConfigUpdate {
  const fields = v.strictObject(
    optionalFields({
      name: nonemptyText,
      rootPath: path,
      metadataProfileId: id,
      definition: v.pipe(v.unknown(), v.transform(parseScanDefinition)),
      registerExistingContent: v.boolean(),
      watchEnabled: v.boolean(),
    }),
  )
  const value = parseValue(
    v.strictObject({ changes: fields, expected: v.exactOptional(fields) }),
    input,
    'Invalid scan configuration edit',
  )
  validateExpectedKeys(value.changes, value.expected)
  return value
}

/** Every participant receives the same original work/type/boundary; it cannot alter them in its result. */
export function parseRecognitionInput(input: unknown): RecognitionInput {
  return parseValue(
    v.strictObject({
      entryType: v.picklist(workTypes),
      path,
      kind: v.picklist(['directory', 'file']),
      clues,
    }),
    input,
    'Invalid work recognition input',
  )
}

/** Null alone means no new information; empty results and copied/format-only variants of original clues are rejected. */
export function parseRecognitionResult(input: RecognitionInput, result: unknown): WorkClues | null {
  if (result === null) {
    return null
  }

  const value = parseIdentificationClues(input.entryType, result)
  if (!hasNewWorkClues(input.clues, value)) {
    throw new DesktopError(
      'InvalidInput',
      'Recognizer result must provide new usable work clues or null',
    )
  }

  return value
}

function workAddResult(input: unknown): AddResult<WorkType> {
  const value = parseAddResult(input)
  if (!isWorkType(value.entry.type)) {
    throw new DesktopError('InvalidInput', 'Scanner candidates must resolve to a work')
  }

  return value as AddResult<WorkType>
}

const discovery = v.strictObject({
  finished: v.boolean(),
  candidateCount: nonnegativeInteger,
  issues: v.array(v.strictObject({ path, error })),
})

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

/** Watch failures and scan failures are independent; observation release never controls the current task. */
export function parseScannerState(input: unknown): ScannerState | null {
  return parseValue(
    v.nullable(
      v.strictObject({
        watch: v.union([
          v.strictObject({
            status: v.picklist(['disabled', 'starting', 'active']),
            error: v.null(),
          }),
          v.strictObject({ status: v.literal('unavailable'), error }),
        ]),
        currentRun: v.nullable(
          v.strictObject({
            scanRunId: id,
            taskRef: v.pipe(v.unknown(), v.transform(parseTaskRunRef)),
          }),
        ),
      }),
    ),
    input,
    'Invalid scanner state',
  )
}

/** Decode historical rule structure without executing it, and verify the fixed metadata profile has the same work type. */
export function parseScanConfigSnapshot(input: unknown): ScanConfigSnapshot {
  const { workType } = parseValue(v.looseObject({ workType: v.picklist(workTypes) }), input)
  return parseValue(
    v.strictObject({
      name: nonemptyText,
      workType: v.literal(workType),
      rootPath: path,
      definition: v.pipe(v.unknown(), v.transform(parseScanDefinitionShape)),
      registerExistingContent: v.boolean(),
      metadataProfile: v.strictObject({
        id,
        name: nonemptyText,
        entryType: v.literal(workType),
        preferredLanguages: v.array(languageSchema),
        definition: v.pipe(
          v.unknown(),
          v.transform((value) => parseMetadataProfileDefinition(workType, value)),
        ),
      }),
    }),
    input,
    'Invalid scan configuration snapshot',
  ) as ScanConfigSnapshot
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
