/** @fileoverview Defines saved showcase sections, atomic form changes and the ten independent preset configurations. */

import * as v from 'valibot'
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import { DesktopError } from '../errors'
import { englishMessages } from '../i18n/en'
import type { CallOptions, StoredDefinition } from '../operations'
import {
  id,
  nonemptyText,
  optionalFields,
  parseValue,
  positiveInteger,
  readRecord,
  unique,
  validateExpectedKeys,
} from '../validation'
import type { EntryType } from './catalog'
import { workTypes } from './catalog'
import type { CollectionQuery, TagQuery } from './organizers'
import { parseCollectionQuery, parseTagQuery } from './organizers'
import { parseEntryQuery, parseQueryReferenceLabels } from './query'
import type { EntryCondition, EntryQuery, EntrySort, QueryReferenceLabel } from './query-values'

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
  readonly createdAt: number
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
  list(call?: CallOptions): Promise<readonly ShowcaseSection[]>
  listPresets(call?: CallOptions): Promise<readonly ShowcasePreset[]>

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

/** Return fresh, complete preset values. Applying one to an existing draft preserves its identity, visibility and position. */
export function getShowcasePresets(): readonly ShowcasePreset[] {
  const labels = englishMessages.showcase.presets

  function entry(
    types: readonly [EntryType, ...EntryType[]],
    conditions: readonly EntryCondition[],
    sort: EntrySort,
  ): ShowcaseQuery {
    return {
      kind: 'entry',
      scope: { type: 'library' },
      search: '',
      rules: [{ enabled: true, types, filter: { match: 'all', conditions } }],
      sort,
      referenceLabels: [],
    }
  }

  function preset(
    key: string,
    label: { readonly name: string; readonly description: string },
    query: ShowcaseQuery,
    layout: ShowcaseFields['layout'] = 'horizontal',
    limit: number | null = 12,
  ): ShowcasePreset {
    return {
      id: key,
      defaultLocale: 'en',
      ...label,
      initial: {
        name: label.name,
        query,
        layout,
        itemSize: 'md',
        limit,
        openMode: 'page',
        isVisible: true,
      },
    }
  }

  const scope = { type: 'scope' } as const
  const lastActive = { type: 'field', field: 'lastActiveAt', direction: 'desc' } as const
  const added = { type: 'field', field: 'effectiveAddedDate', direction: 'desc' } as const
  const favorite = [{ field: 'favorite', op: 'is', value: true }] as const
  return [
    preset(
      'recently-used-works',
      labels.recentlyUsed,
      entry(workTypes, [{ field: 'lastActiveAt', op: 'present' }], lastActive),
    ),
    preset(
      'active-works',
      labels.active,
      entry(workTypes, [{ field: 'status', op: 'in', values: ['active'] }], lastActive),
    ),
    preset(
      'planned-works',
      labels.planned,
      entry(workTypes, [{ field: 'status', op: 'in', values: ['planned'] }], added),
    ),
    preset('recently-added-works', labels.recentlyAdded, entry(workTypes, [], added), 'grid', null),
    preset('favorite-works', labels.favoriteWorks, entry(workTypes, favorite, scope), 'grid', 24),
    preset(
      'personal-rating-ranking',
      labels.rating,
      entry(workTypes, [{ field: 'rating', op: 'present' }], {
        type: 'field',
        field: 'rating',
        direction: 'desc',
      }),
    ),
    preset(
      'favorite-characters',
      labels.favoriteCharacters,
      entry(['character'], favorite, scope),
      'grid',
      24,
    ),
    preset(
      'favorite-persons',
      labels.favoritePersons,
      entry(['person'], favorite, scope),
      'grid',
      24,
    ),
    preset(
      'favorite-organizations',
      labels.favoriteOrganizations,
      entry(['organization'], favorite, scope),
      'grid',
      24,
    ),
    preset('collections', labels.collections, { kind: 'collection', search: '', sort: scope }),
  ]
}
