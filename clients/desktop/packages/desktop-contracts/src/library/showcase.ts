import type { NonEmptyArray, StoredDefinition, CallOptions } from '../operations'
import type { ReorderInput } from './ordering'
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import {
  fromParser,
  parseRecord,
  parseValue,
  nonemptyText,
  positiveInteger,
  optionalFields,
  validateExpectedKeys,
} from '../validation'
import * as v from 'valibot'
import {
  parseCollectionQuery,
  parseTagQuery,
  type CollectionQuery,
  type TagQuery,
} from './organizers'
import {
  parseEntryQuery,
  parseQueryReferenceLabels,
  type QueryReferenceLabel,
  type EntryQuery,
} from './query/definition'

export type ShowcaseQuery =
  | ({
      readonly kind: 'entry'
      readonly referenceLabels: readonly QueryReferenceLabel[]
    } & EntryQuery)
  | ({ readonly kind: 'collection' } & CollectionQuery)
  | ({ readonly kind: 'tag' } & TagQuery)

export interface ShowcaseFields {
  readonly name: string
  readonly query: ShowcaseQuery

  readonly layout: 'horizontal' | 'grid'
  readonly itemSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** Logical display limit; null keeps the complete result available through interval requests. */
  readonly limit: number | null

  readonly openMode: 'page' | 'dialog'
  readonly isVisible: boolean
}

/** An invalid query stays local to its section and is preserved as invalid. */
export interface ShowcaseSection extends Omit<ShowcaseFields, 'query'> {
  readonly id: string
  readonly query: StoredDefinition<ShowcaseQuery>
  readonly sortOrder: number
  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number
  /** UTC milliseconds since the Unix epoch. */
  readonly updatedAt: number
}

/**
 * The query and reference labels form one edit unit. Name and display fields have independent
 * baselines.
 */
export interface ShowcaseUpdate {
  readonly changes: Partial<ShowcaseFields>
  readonly expected?: Partial<ShowcaseFields>
}

export interface ShowcasePreset {
  readonly id: string
  readonly defaultLocale: string
  readonly name: LocalizedText
  readonly description: LocalizedText
  readonly initial: ShowcaseFields
}

export interface ShowcaseApi {
  /**
   * Reads all saved sections in formal order, including hidden sections and invalid stored queries.
   */
  list(call?: CallOptions): Promise<readonly ShowcaseSection[]>

  /**
   * Reads a saved section, preserving query validity and returning null when the section is absent.
   */
  get(id: string, call?: CallOptions): Promise<ShowcaseSection | null>

  /** Preset definitions are copied to drafts. Use creation to save a section. */
  listPresets(call?: CallOptions): Promise<readonly ShowcasePreset[]>

  /** Saves a new independent section at the end of the directory. */
  create(input: ShowcaseFields, call?: CallOptions): Promise<ShowcaseSection>

  /**
   * Appends atomically and returns sections in input order. Equal configurations create separate
   * sections.
   */
  createMany(
    input: NonEmptyArray<ShowcaseFields>,
    call?: CallOptions,
  ): Promise<readonly ShowcaseSection[]>

  /** Compares and commits changed fields independently of unrelated directory ordering. */
  update(id: string, input: ShowcaseUpdate, call?: CallOptions): Promise<ShowcaseSection>

  /** Removes a section configuration while preserving the library content it displayed. */
  delete(id: string, call?: CallOptions): Promise<void>

  /**
   * Reorders selected sections against the complete saved directory baseline, including hidden
   * sections.
   */
  reorder(input: ReorderInput, call?: CallOptions): Promise<void>
}

/**
 * Parses the selected reader's query and validates entry reference labels separately from execution
 * fields.
 */
export function parseShowcaseQuery(input: unknown): ShowcaseQuery {
  const { kind: kindInput, ...body } = parseRecord(input)
  const kind = parseValue(v.picklist(['entry', 'collection', 'tag']), kindInput)
  if (kind === 'collection') {
    return { kind, ...parseCollectionQuery(body) }
  }
  if (kind === 'tag') {
    return { kind, ...parseTagQuery(body) }
  }

  const { referenceLabels, ...queryInput } = body
  const query = parseEntryQuery(queryInput)
  const labels = parseQueryReferenceLabels(referenceLabels)
  return { kind, ...query, referenceLabels: labels }
}

const fields = {
  name: v.pipe(
    nonemptyText,
    v.transform((value) => value.trim()),
  ),
  query: fromParser(parseShowcaseQuery),

  layout: v.picklist(['horizontal', 'grid']),
  itemSize: v.picklist(['xs', 'sm', 'md', 'lg', 'xl']),
  limit: v.nullable(positiveInteger),

  openMode: v.picklist(['page', 'dialog']),
  isVisible: v.boolean(),
}

/** Parses a complete section configuration and trims its name. */
export function parseShowcaseFields(input: unknown): ShowcaseFields {
  return parseValue(v.strictObject(fields), input, 'Invalid showcase configuration')
}

/** Parses a nonempty creation batch while retaining equal configurations as distinct inputs. */
export function parseShowcaseCreateMany(input: unknown): NonEmptyArray<ShowcaseFields> {
  const section = v.strictObject(fields)
  return parseValue(v.tupleWithRest([section], section), input, 'Invalid showcase creation batch')
}

/** The query and its reference labels are validated as one complete value. */
export function parseShowcaseUpdate(input: unknown): ShowcaseUpdate {
  const partial = v.strictObject(optionalFields(fields))
  const value = parseValue(
    v.strictObject({ changes: partial, expected: v.exactOptional(partial) }),
    input,
    'Invalid showcase edit',
  )
  validateExpectedKeys(value.changes, value.expected)
  return value
}
