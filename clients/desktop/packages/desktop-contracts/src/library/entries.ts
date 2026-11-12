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

export interface EvaluationUpdate {
  readonly changes: Partial<Evaluation>
  readonly expected?: Partial<Evaluation>
}

export interface WorkStatusUpdate {
  readonly status: WorkStatus | null
  readonly expected?: { readonly status: WorkStatus | null }
}

/** Same-kind sources and the chosen survivor are explicit; similarity, filters and current page selection never stand in for IDs. */
export type EntryMergeInput = {
  [K in EntryType]: { readonly sources: NonEmptyArray<EntryRef<K>>; readonly target: EntryRef<K> }
}[EntryType]

export interface EntriesApi {
  /**
   * Read one interval of the complete visible query with only the requested projections; count
   * and rows share the same read.
   */
  list(query: EntryQuery, options: EntryListOptions, call?: CallOptions): Promise<EntryListResult>

  /**
   * Read one visible entry's saved details without opening content or acquiring its attachments.
   */
  get<T extends EntryType>(ref: EntryRef<T>, call?: CallOptions): Promise<EntryDetails<T> | null>

  /** Long saved Markdown is fetched separately; the ordinary visible no-match/empty-body result is null. */
  getDescription(ref: EntryRef, call?: CallOptions): Promise<string | null>

  /**
   * Locate a visible matching entry within the query's current order; absence or a nonmatching
   * target returns null.
   */
  locate(
    query: EntryQuery,
    target: EntryRef,
    options: EntryLocateOptions,
    call?: CallOptions,
  ): Promise<EntryLocateResult | null>

  /**
   * Read complete collection-group boundaries for this query, independently of the currently
   * loaded intervals.
   */
  groups(
    query: EntryQuery,
    grouping: { readonly type: 'collections' },
    call?: CallOptions,
  ): Promise<EntryGroupsResult>

  /**
   * Resolve a fixed deduplicated selection in one read; changed endpoints or crossed groups fail
   * with SelectionChanged.
   */
  selectRefs(
    query: EntryQuery,
    selection: EntrySelection,
    call?: CallOptions,
  ): Promise<readonly EntryRef[]>

  /** Visible lookup only: a null result is never evidence that an identity is free for binding. */
  findByExternalIdentity(identity: ExternalIdentity, call?: CallOptions): Promise<EntryRef | null>

  /**
   * Commit the complete entry, initial personal values and adopted attachments together; return
   * its stable typed identity.
   */
  create<I extends EntryCreate>(input: I, call?: CallOptions): Promise<EntryRef<I['type']>>

  /**
   * Compare and commit the submitted fields and their actual related references; unrelated
   * fields do not form a whole-row lock.
   */
  update(
    ...args: {
      [K in EntryType]: [ref: EntryRef<K>, input: Omit<EntryUpdate<K>, 'ref'>, call?: CallOptions]
    }[EntryType]
  ): Promise<void>

  /** One short atomic commit; a missing target or failed baseline rejects the complete batch. */
  updateMany(input: NonEmptyArray<EntryUpdate>, call?: CallOptions): Promise<void>

  /**
   * Compare and save only the submitted personal rating or favorite fields, independently of
   * current work status.
   */
  setEvaluation(ref: EntryRef, input: EvaluationUpdate, call?: CallOptions): Promise<void>

  /**
   * Set or clear the work's current status after its optional comparison; completion history
   * remains unchanged.
   */
  setWorkStatus(work: WorkRef, input: WorkStatusUpdate, call?: CallOptions): Promise<void>

  /**
   * Bind the exact external identity after a full uniqueness check, including hidden records;
   * binding never implies a merge.
   */
  bindExternalIdentity(ref: EntryRef, identity: ExternalIdentity, call?: CallOptions): Promise<void>

  /**
   * Remove this exact binding without deleting the entry, source data or other external
   * identities.
   */
  unbindExternalIdentity(
    ref: EntryRef,
    identity: ExternalIdentity,
    call?: CallOptions,
  ): Promise<void>
}

/** Validate a plain current-value edit without introducing the entries.update evaluation nesting. */
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

/** Status is a current choice, not a completed state or an instruction to create/erase completion history. */
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

/** Parse a fixed nonempty short batch and reject multiple edits of the same actual identity in one operation. */
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

/** Check kind/identity constraints only; existence, occupancy, uniqueness and actual fixed merge rules belong to the write owner. */
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

/** Validate complete applicable detail fields, without introducing unrelated medium fields, long bodies or writable summaries. */
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
