/** @fileoverview Defines saved showcase sections, atomic form changes and the ten independent preset configurations. */

import type { QueryReferenceLabel, EntryQuery } from './query/definition'
import type { CollectionQuery, TagQuery } from './organizers'
import type { StoredDefinition, CallOptions } from '../operations'
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import {
  readRecord,
  parseValue,
  nonemptyText,
  positiveInteger,
  optionalFields,
  id,
  unique,
  validateExpectedKeys,
} from '../validation'
import * as v from 'valibot'
import { parseCollectionQuery, parseTagQuery } from './organizers'
import { parseEntryQuery, parseQueryReferenceLabels } from './query/definition'
import { DesktopError } from '../errors'

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

export type ShowcaseSectionRef = { readonly id: string } | { readonly key: string }

/** Each form change is one atomic configuration operation. Full order includes hidden sections. */
export interface ShowcaseChanges {
  readonly create?: readonly { readonly key: string; readonly data: ShowcaseFields }[]

  readonly update?: readonly {
    readonly id: string
    readonly changes: Partial<ShowcaseFields>
    readonly expected?: Partial<ShowcaseFields>
  }[]

  /** Form deletion compares the complete original configuration. An explicit immediate delete may omit it. */
  readonly delete?: readonly { readonly id: string; readonly expected?: ShowcaseFields }[]

  readonly order?: {
    readonly items: readonly ShowcaseSectionRef[]
    readonly expected: readonly string[]
  }
}

export interface ShowcaseChangeResult {
  readonly sections: readonly ShowcaseSection[]
  readonly created: Readonly<Record<string, string>>
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

  /**
   * Read the fixed preset configurations for copying into a draft; listing never creates
   * sections.
   */
  listPresets(call?: CallOptions): Promise<readonly ShowcasePreset[]>

  /**
   * Compare and commit all submitted section changes and full-order intent atomically; return
   * the saved sections and created identities.
   */
  applyChanges(input: ShowcaseChanges, call?: CallOptions): Promise<ShowcaseChangeResult>
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

/** Reject contradictory edits and unresolved create keys before any persistent work. Current order is checked at commit. */
export function parseShowcaseChanges(input: unknown): ShowcaseChanges {
  const partial = v.strictObject(optionalFields(fields))
  const value = parseValue(
    v.strictObject({
      create: v.exactOptional(
        v.pipe(
          v.array(v.strictObject({ key: id, data: v.strictObject(fields) })),
          v.check((items) => unique(items, (item) => item.key)),
        ),
      ),
      update: v.exactOptional(
        v.pipe(
          v.array(v.strictObject({ id, changes: partial, expected: v.exactOptional(partial) })),
          v.check((items) => unique(items, (item) => item.id)),
        ),
      ),
      delete: v.exactOptional(
        v.pipe(
          v.array(v.strictObject({ id, expected: v.exactOptional(v.strictObject(fields)) })),
          v.check((items) => unique(items, (item) => item.id)),
        ),
      ),
      order: v.exactOptional(
        v.strictObject({
          items: v.pipe(
            v.array(v.union([v.strictObject({ id }), v.strictObject({ key: id })])),
            v.check((refs) => unique(refs, (ref) => JSON.stringify(ref))),
          ),
          expected: v.pipe(
            v.array(id),
            v.check((ids) => unique(ids, (value) => value)),
          ),
        }),
      ),
    }),
    input,
    'Invalid showcase changes',
  )

  const removed = new Set(value.delete?.map((item) => item.id))
  const created = new Set(value.create?.map((item) => item.key))
  for (const update of value.update ?? []) {
    if (removed.has(update.id)) {
      throw new DesktopError('InvalidInput', 'A section cannot be edited and deleted together')
    }
    validateExpectedKeys(update.changes, update.expected)
  }

  if (
    value.order?.items.some((ref) => ('key' in ref ? !created.has(ref.key) : removed.has(ref.id)))
  ) {
    throw new DesktopError(
      'InvalidInput',
      'Final showcase order contains a missing create key or a removed section',
    )
  }

  return value
}
