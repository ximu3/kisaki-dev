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
  fromParser,
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
  type Evaluation,
  type WorkStatus,
  type EntryType,
  type EntryRef,
  type EntryDetails,
  type ExternalIdentity,
  type EntryCreate,
  type EntryUpdate,
  type WorkRef,
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

export type EntryMergeInput = {
  [K in EntryType]: { readonly sources: NonEmptyArray<EntryRef<K>>; readonly target: EntryRef<K> }
}[EntryType]

export interface EntriesApi {
  /** The total and interval rows come from the same read. */
  list(query: EntryQuery, options: EntryListOptions, call?: CallOptions): Promise<EntryListResult>

  /**
   * Returns null outside the visible scope. A details read leaves content closed and acquires no
   * attachment hold.
   */
  get<T extends EntryType>(ref: EntryRef<T>, call?: CallOptions): Promise<EntryDetails<T> | null>

  /** Returns null when the entry is hidden, missing or has an empty Markdown body. */
  getDescription(ref: EntryRef, call?: CallOptions): Promise<string | null>

  /** Returns null if the target is absent or falls outside the current query. */
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
   * Changed endpoints or crossed groups fail with SelectionChanged. The selection otherwise
   * reflects one read and deduplicates identities.
   */
  selectRefs(
    query: EntryQuery,
    selection: EntrySelection,
    call?: CallOptions,
  ): Promise<readonly EntryRef[]>

  /**
   * Looks up the exact identity in the visible scope. Hidden bindings can still prevent a new
   * binding.
   */
  findByExternalIdentity(identity: ExternalIdentity, call?: CallOptions): Promise<EntryRef | null>

  /** The entry, initial personal values and adopted attachments commit together. */
  create<I extends EntryCreate>(input: I, call?: CallOptions): Promise<EntryRef<I['type']>>

  /**
   * The write compares submitted fields and their related references independently of unrelated
   * fields.
   */
  update(
    ...args: {
      [K in EntryType]: [ref: EntryRef<K>, input: Omit<EntryUpdate<K>, 'ref'>, call?: CallOptions]
    }[EntryType]
  ): Promise<void>

  /** A missing target or failed baseline rejects the entire edit batch. */
  updateMany(input: NonEmptyArray<EntryUpdate>, call?: CallOptions): Promise<void>

  /** Compares and saves submitted rating or favorite fields independently of work status. */
  setEvaluation(ref: EntryRef, input: EvaluationUpdate, call?: CallOptions): Promise<void>

  /**
   * Sets or clears current work status after an optional comparison, preserving completion history.
   */
  setWorkStatus(work: WorkRef, input: WorkStatusUpdate, call?: CallOptions): Promise<void>

  /**
   * Uniqueness checks include hidden records. Merging entries requires the explicit merge
   * operation.
   */
  bindExternalIdentity(ref: EntryRef, identity: ExternalIdentity, call?: CallOptions): Promise<void>

  /** Removes the exact binding while preserving the entry, source data and other identities. */
  unbindExternalIdentity(
    ref: EntryRef,
    identity: ExternalIdentity,
    call?: CallOptions,
  ): Promise<void>
}

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
  const item = fromParser(parseEntryUpdate)
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
 * Requires distinct same-kind sources and a separate survivor. The write owner checks existence,
 * occupancy, external-identity uniqueness and merge rules.
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
