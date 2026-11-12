/** @fileoverview Declares complete entry reads and writes, independent personal edits and fixed identity operations. */

import type {
  Evaluation,
  WorkStatus,
  EntryType,
  EntryRef,
  EntryDetails,
  ExternalIdentity,
  EntryCreate,
  EntryUpdate,
  WorkRef,
} from './catalog'
import type { NonEmptyArray, CallOptions } from '../operations'
import type { EntryQuery } from './query/definition'
import type {
  EntryListOptions,
  EntryListResult,
  EntryLocateOptions,
  EntryLocateResult,
  EntryGroupsResult,
} from './query/listing'
import type { EntrySelection } from './query/selection'
import * as v from 'valibot'
import {
  optionalFields,
  parseValue,
  validateExpectedKeys,
  unique,
  omitFields,
  timestamp,
  nonnegativeInteger,
} from '../validation'
import {
  evaluationEntries,
  statusSchema,
  parseEntryUpdate,
  entryRefSchema,
  entryTypes,
  entryCommonEntries,
  entrySpecificEntries,
  isWorkType,
  recordEntries,
  calendarDateSchema,
} from './catalog'
import { DesktopError } from '../errors'

/** Independent personal rating or favorite changes with matching expected values. */
export interface EvaluationUpdate {
  readonly changes: Partial<Evaluation>
  readonly expected?: Partial<Evaluation>
}

/**
 * An explicit current-status selection or clearing, with an optional original-status comparison.
 */
export interface WorkStatusUpdate {
  readonly status: WorkStatus | null
  readonly expected?: { readonly status: WorkStatus | null }
}

/** Explicit same-kind source identities and the chosen merge survivor. */
export type EntryMergeInput = {
  [K in EntryType]: { readonly sources: NonEmptyArray<EntryRef<K>>; readonly target: EntryRef<K> }
}[EntryType]

/** Visible entry queries, atomic catalog edits and explicit identity bindings. */
export interface EntriesApi {
  /**
   * Reads an interval of the complete visible query with the requested projections.
   *
   * Count and rows share the same read.
   */
  list(query: EntryQuery, options: EntryListOptions, call?: CallOptions): Promise<EntryListResult>

  /**
   * Reads a visible entry's saved details, or null when it is absent from the visible scope.
   *
   * The read neither opens content nor acquires attachments.
   */
  get<T extends EntryType>(ref: EntryRef<T>, call?: CallOptions): Promise<EntryDetails<T> | null>

  /**
   * Reads saved Markdown separately from ordinary entry details.
   *
   * No visible match or an empty body returns null.
   */
  getDescription(ref: EntryRef, call?: CallOptions): Promise<string | null>

  /**
   * Locates a visible matching entry in the query's current order.
   *
   * An absent or nonmatching target returns null.
   */
  locate(
    query: EntryQuery,
    target: EntryRef,
    options: EntryLocateOptions,
    call?: CallOptions,
  ): Promise<EntryLocateResult | null>

  /** Reads complete collection-group boundaries independently of loaded intervals. */
  groups(
    query: EntryQuery,
    grouping: { readonly type: 'collections' },
    call?: CallOptions,
  ): Promise<EntryGroupsResult>

  /**
   * Resolves a fixed, deduplicated selection in one read.
   *
   * Changed endpoints or crossed groups fail with SelectionChanged.
   */
  selectRefs(
    query: EntryQuery,
    selection: EntrySelection,
    call?: CallOptions,
  ): Promise<readonly EntryRef[]>

  /**
   * Finds a visible entry by exact external identity.
   *
   * A null result does not establish that the identity is available for binding.
   */
  findByExternalIdentity(identity: ExternalIdentity, call?: CallOptions): Promise<EntryRef | null>

  /**
   * Commits the entry, initial personal values and adopted attachments together.
   *
   * Returns the entry's stable typed identity.
   */
  create<I extends EntryCreate>(input: I, call?: CallOptions): Promise<EntryRef<I['type']>>

  /**
   * Compares and commits submitted fields and their actual related references.
   *
   * Unrelated fields do not form a whole-row lock.
   */
  update(
    ...args: {
      [K in EntryType]: [ref: EntryRef<K>, input: Omit<EntryUpdate<K>, 'ref'>, call?: CallOptions]
    }[EntryType]
  ): Promise<void>

  /**
   * Commits a fixed edit batch atomically.
   *
   * A missing target or failed baseline rejects the complete batch.
   */
  updateMany(input: NonEmptyArray<EntryUpdate>, call?: CallOptions): Promise<void>

  /** Compares and saves submitted rating or favorite fields independently of work status. */
  setEvaluation(ref: EntryRef, input: EvaluationUpdate, call?: CallOptions): Promise<void>

  /**
   * Sets or clears current work status after an optional comparison, preserving completion history.
   */
  setWorkStatus(work: WorkRef, input: WorkStatusUpdate, call?: CallOptions): Promise<void>

  /**
   * Binds an exact external identity after a complete uniqueness check, including hidden records.
   *
   * Binding does not merge entries.
   */
  bindExternalIdentity(ref: EntryRef, identity: ExternalIdentity, call?: CallOptions): Promise<void>

  /** Removes the exact binding while preserving the entry, source data and other identities. */
  unbindExternalIdentity(
    ref: EntryRef,
    identity: ExternalIdentity,
    call?: CallOptions,
  ): Promise<void>
}

/** Parses independent evaluation changes and matching expected fields. */
export function parseEvaluationUpdate(input: unknown): EvaluationUpdate {
  const fields = v.strictObject(optionalFields(evaluationEntries))
  const value = parseValue(
    v.strictObject({ changes: fields, expected: v.exactOptional(fields) }),
    input,
    'Invalid evaluation edit',
  )
  validateExpectedKeys(value.changes, value.expected)
  return value
}

/** Parses the requested current status and optional original-status comparison. */
export function parseWorkStatusUpdate(input: unknown): WorkStatusUpdate {
  return parseValue(
    v.strictObject({
      status: v.nullable(statusSchema),
      expected: v.exactOptional(v.strictObject({ status: v.nullable(statusSchema) })),
    }),
    input,
    'Invalid work status edit',
  )
}

/** Parses a nonempty batch and rejects repeated edits of the same entry identity. */
export function parseEntryUpdates(input: unknown): NonEmptyArray<EntryUpdate> {
  const item = v.pipe(v.unknown(), v.transform(parseEntryUpdate))
  return parseValue(
    v.pipe(
      v.tupleWithRest([item], item),
      v.check((values) => unique(values, (value) => value.ref.id)),
    ),
    input,
    'Invalid entry edit batch',
  )
}

/**
 * Parses distinct same-kind merge sources and a separate survivor.
 *
 * The write owner checks existence, occupancy, external-identity uniqueness and merge rules.
 */
export function parseEntryMergeInput(input: unknown): EntryMergeInput {
  const value = parseValue(
    v.strictObject({
      sources: v.pipe(
        v.tupleWithRest([entryRefSchema], entryRefSchema),
        v.check((refs) => unique(refs, (ref) => ref.id)),
      ),
      target: entryRefSchema,
    }),
    input,
    'Invalid entry merge',
  )
  if (
    value.sources.some(
      (source) => source.id === value.target.id || source.type !== value.target.type,
    )
  ) {
    throw new DesktopError(
      'InvalidInput',
      'Entry merge requires distinct same-kind sources and survivor',
    )
  }

  return value as EntryMergeInput
}

/** Parses complete detail fields and derived summaries for the selected entry kind. */
export function parseEntryDetails(input: unknown): EntryDetails {
  const { type } = parseValue(
    v.looseObject({ type: v.picklist(entryTypes) }),
    input,
    'Invalid entry detail',
  )
  const common = omitFields(entryCommonEntries, ['description'])
  const fields: Record<string, v.GenericSchema> = {
    ...common,
    ...entrySpecificEntries[type],
    id: entryRefSchema.entries.id,
    type: v.literal(type),
    createdAt: timestamp,
    updatedAt: timestamp,
    evaluation: v.strictObject(evaluationEntries),
  }
  if (isWorkType(type)) {
    Object.assign(fields, {
      record: v.strictObject(recordEntries),
      totalDurationMs: nonnegativeInteger,
      lastActiveAt: v.nullable(timestamp),
      completionCount: nonnegativeInteger,
      firstCompletedDate: v.nullable(calendarDateSchema),
      lastCompletedDate: v.nullable(calendarDateSchema),
    })
  }

  return parseValue(v.strictObject(fields), input, 'Invalid entry detail') as EntryDetails
}
