/** @fileoverview Defines independently saved showcase sections, explicit batch creation and fixed preset configurations. */

import type { QueryReferenceLabel, EntryQuery } from './query/definition'
import type { CollectionQuery, TagQuery } from './organizers'
import type { NonEmptyArray, StoredDefinition, CallOptions } from '../operations'
import type { ReorderInput } from './ordering'
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import {
  parseRecord,
  parseValue,
  nonemptyText,
  positiveInteger,
  optionalFields,
  validateExpectedKeys,
} from '../validation'
import * as v from 'valibot'
import { parseCollectionQuery, parseTagQuery } from './organizers'
import { parseEntryQuery, parseQueryReferenceLabels } from './query/definition'

/** Showcase query routed by kind to an existing entry, collection or tag reader. */
export type ShowcaseQuery =
  | ({
      readonly kind: 'entry'
      readonly referenceLabels: readonly QueryReferenceLabel[]
    } & EntryQuery)
  | ({ readonly kind: 'collection' } & CollectionQuery)
  | ({ readonly kind: 'tag' } & TagQuery)

/** Saved query and display configuration for one showcase section. */
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

/**
 * Saved showcase section with its order, timestamps and explicit query validity.
 *
 * A damaged query remains local to its section and is preserved as invalid.
 */
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
 * Section field edits and optional original values.
 *
 * The query and its reference labels form one edit unit; name and display fields have independent
 * baselines.
 */
export interface ShowcaseUpdate {
  readonly changes: Partial<ShowcaseFields>
  readonly expected?: Partial<ShowcaseFields>
}

/** Fixed, localized configuration available as the starting point for a section draft. */
export interface ShowcasePreset {
  readonly id: string
  readonly defaultLocale: string
  readonly name: LocalizedText
  readonly description: LocalizedText
  readonly initial: ShowcaseFields
}

/** Operations on independently saved showcase sections and fixed draft presets. */
export interface ShowcaseApi {
  /**
   * Reads all saved sections in formal order, including hidden sections and invalid stored queries.
   */
  list(call?: CallOptions): Promise<readonly ShowcaseSection[]>

  /**
   * Reads a saved section, preserving query validity and returning null when the section is absent.
   */
  get(id: string, call?: CallOptions): Promise<ShowcaseSection | null>

  /**
   * Reads fixed preset configurations for copying into drafts.
   *
   * Listing presets does not create sections.
   */
  listPresets(call?: CallOptions): Promise<readonly ShowcasePreset[]>

  /** Saves a new independent section at the end of the directory. */
  create(input: ShowcaseFields, call?: CallOptions): Promise<ShowcaseSection>

  /**
   * Atomically appends an explicit batch and returns saved sections in input order.
   *
   * Equal configurations remain independent sections.
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

/**
 * Complete editable showcase-section query and presentation fields shared by creation and updates.
 */
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

/** Parses a complete section configuration and trims its name. */
export function parseShowcaseFields(input: unknown): ShowcaseFields {
  return parseValue(v.strictObject(fields), input, 'Invalid showcase configuration')
}

/** Parses a nonempty creation batch while retaining equal configurations as distinct inputs. */
export function parseShowcaseCreateMany(input: unknown): NonEmptyArray<ShowcaseFields> {
  const section = v.strictObject(fields)
  return parseValue(v.tupleWithRest([section], section), input, 'Invalid showcase creation batch')
}

/**
 * Parses section edits and requires baselines to correspond to changed fields.
 *
 * The query and its reference labels are validated as one complete value.
 */
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
