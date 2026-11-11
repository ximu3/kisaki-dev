/** @fileoverview Defines independently saved showcase sections, explicit batch creation and fixed preset configurations. */

import type { QueryReferenceLabel, EntryQuery } from './query/definition'
import type { CollectionQuery, TagQuery } from './organizers'
import type { NonEmptyArray, StoredDefinition, CallOptions } from '../operations'
import type { ReorderInput } from './ordering'
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import {
  readRecord,
  parseValue,
  nonemptyText,
  positiveInteger,
  optionalFields,
  validateExpectedKeys,
} from '../validation'
import * as v from 'valibot'
import { parseCollectionQuery, parseTagQuery } from './organizers'
import { parseEntryQuery, parseQueryReferenceLabels } from './query/definition'

/** Query kind selects an existing public reader. Showcase never owns a second query engine or membership set. */
export type ShowcaseQuery =
  | ({
      readonly kind: 'entry'
      readonly referenceLabels: readonly QueryReferenceLabel[]
    } & EntryQuery)
  | ({ readonly kind: 'collection' } & CollectionQuery)
  | ({ readonly kind: 'tag' } & TagQuery)

/** Section limit bounds logical display, not request size; null keeps the complete result available through intervals. */
export interface ShowcaseFields {
  readonly name: string
  readonly query: ShowcaseQuery

  readonly layout: 'horizontal' | 'grid'
  readonly itemSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  readonly limit: number | null

  readonly openMode: 'page' | 'dialog'
  readonly isVisible: boolean
}

/** A damaged saved query remains local to its section and cannot silently become an unrestricted query. */
export interface ShowcaseSection extends Omit<ShowcaseFields, 'query'> {
  readonly id: string
  readonly query: StoredDefinition<ShowcaseQuery>
  readonly sortOrder: number
  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number
  /** UTC milliseconds since the Unix epoch. */
  readonly updatedAt: number
}

/** Query is one edit unit; title and display fields have independent baselines. */
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

/** Lists return all saved configurations. Presets fill drafts and are never automatically materialized. */
export interface ShowcaseApi {
  /**
   * Read every saved section in formal order, including hidden sections and explicitly invalid
   * stored queries.
   */
  list(call?: CallOptions): Promise<readonly ShowcaseSection[]>

  /** Read one saved configuration, retaining an invalid stored query explicitly. */
  get(id: string, call?: CallOptions): Promise<ShowcaseSection | null>

  /**
   * Read the fixed preset configurations for copying into a draft; listing never creates
   * sections.
   */
  listPresets(call?: CallOptions): Promise<readonly ShowcasePreset[]>

  /** Save a new independent section at the end of the directory. */
  create(input: ShowcaseFields, call?: CallOptions): Promise<ShowcaseSection>

  /**
   * Atomically append an explicit batch and return saved sections in input order. Equal
   * configurations remain independent.
   */
  createMany(
    input: NonEmptyArray<ShowcaseFields>,
    call?: CallOptions,
  ): Promise<readonly ShowcaseSection[]>

  /** Compare and commit changed fields without depending on unrelated directory ordering. */
  update(id: string, input: ShowcaseUpdate, call?: CallOptions): Promise<ShowcaseSection>

  /** Remove the section configuration; library content keeps its own lifetime. */
  delete(id: string, call?: CallOptions): Promise<void>

  /** Reorder selected sections against the complete saved directory baseline, including hidden sections. */
  reorder(input: ReorderInput, call?: CallOptions): Promise<void>
}

/** Parse the selected reader's exact query and keep reference labels out of execution parameters. */
export function parseShowcaseQuery(input: unknown): ShowcaseQuery {
  const { kind: kindInput, ...body } = readRecord(input)
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
  query: v.pipe(v.unknown(), v.transform(parseShowcaseQuery)),

  layout: v.picklist(['horizontal', 'grid']),
  itemSize: v.picklist(['xs', 'sm', 'md', 'lg', 'xl']),
  limit: v.nullable(positiveInteger),

  openMode: v.picklist(['page', 'dialog']),
  isVisible: v.boolean(),
}

/** Validate complete section configuration without confusing its display limit with a list request limit. */
export function parseShowcaseFields(input: unknown): ShowcaseFields {
  return parseValue(v.strictObject(fields), input, 'Invalid showcase configuration')
}

/** Validate an explicit nonempty creation batch without merging equal configurations. */
export function parseShowcaseCreateMany(input: unknown): NonEmptyArray<ShowcaseFields> {
  const section = v.strictObject(fields)
  return parseValue(v.tupleWithRest([section], section), input, 'Invalid showcase creation batch')
}

/** Ordinary editing compares only changed fields; query and its reference labels are one complete value. */
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
