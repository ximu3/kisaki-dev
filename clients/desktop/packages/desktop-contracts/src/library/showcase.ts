/** @fileoverview Defines saved showcase sections and the fixed preset catalog using ordinary library queries. */

import * as v from 'valibot'
import type { DefinitionRead } from '../definition'
import { invalidInput } from '../errors'
import type { CallOptions, Disposable } from '../execution'
import { objectSchema, plainRecordSchema } from '../schema'
import {
  exactPartialEntries,
  hasRelatedExpected,
  hasUniqueKeys,
  nonemptyStringSchema,
  nonnegativeIntegerSchema,
  parseContract,
} from '../validation'
import { workTypes, type EntryType } from './identity'
import {
  parseCollectionQuery,
  parseTagQuery,
  queryReferenceLabelsSchema,
  type CollectionQuery,
  type QueryReferenceLabel,
  type TagQuery,
} from './organizers'
import { parseEntryQuery, type EntryCondition, type EntryQuery, type EntrySort } from './queries'

/** The discriminator and saved labels belong to configuration, and are removed before ordinary list calls. */
export type ShowcaseQuery =
  | ({
      readonly kind: 'entry'
      readonly referenceLabels: readonly QueryReferenceLabel[]
    } & EntryQuery)
  | ({ readonly kind: 'collection' } & CollectionQuery)
  | ({ readonly kind: 'tag' } & TagQuery)
export interface ShowcaseConfiguration {
  readonly name: string
  readonly query: ShowcaseQuery
  readonly layout: 'horizontal' | 'grid'
  readonly itemSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  readonly openMode: 'page' | 'dialog'
  readonly limit: number | null
  readonly isVisible: boolean
}
/** Corrupt queries remain visible and non-executable; display metadata is still independently manageable. */
export interface ShowcaseSection extends Omit<ShowcaseConfiguration, 'query'> {
  readonly id: string
  readonly query: DefinitionRead<ShowcaseQuery>
  readonly sortOrder: number
  readonly createdAt: number
  readonly updatedAt: number
}
export interface ShowcaseChanges {
  readonly create?: readonly ({ readonly key: string } & ShowcaseConfiguration)[]
  readonly update?: readonly {
    readonly id: string
    readonly changes: Partial<ShowcaseConfiguration>
    readonly expected?: Partial<ShowcaseConfiguration>
  }[]
  readonly delete?: readonly { readonly id: string; readonly expected?: ShowcaseConfiguration }[]
  readonly order?: {
    readonly items: readonly ({ readonly id: string } | { readonly key: string })[]
    readonly expected: { readonly order: readonly string[] }
  }
}
export interface ShowcaseChangeResult {
  readonly sections: readonly ShowcaseSection[]
  readonly created: Readonly<Record<string, string>>
}
export const showcasePresetIds = [
  'recently-used-works',
  'active-works',
  'planned-works',
  'recently-added-works',
  'favorite-works',
  'personal-rating-ranking',
  'favorite-characters',
  'favorite-persons',
  'favorite-organizations',
  'collections',
] as const
export type ShowcasePresetId = (typeof showcasePresetIds)[number]
/** Stable catalog identity never persists as a binding on an adopted section. Names are resolved into ordinary draft text. */
export interface ShowcasePreset {
  readonly id: ShowcasePresetId
  readonly name: string
  readonly description: string
  readonly configuration: ShowcaseConfiguration
}
export interface ShowcaseApi {
  /** Read every saved configuration, including hidden/invalid sections, in actual order without querying its content. */
  list(call?: CallOptions): Promise<readonly ShowcaseSection[]>
  /** Read the same fixed preset catalog used by regular editing and onboarding; selecting only fills a draft. */
  listPresets(call?: CallOptions): Promise<readonly ShowcasePreset[]>
  /** Validate all targets and baselines, then apply this exact section edit atomically; new keys map only to actual creations. */
  applyChanges(input: ShowcaseChanges, call?: CallOptions): Promise<ShowcaseChangeResult>
  /** Notify that saved configurations or order should be reread. */
  onInvalidated(listener: () => void): Disposable
}

/** Parse a saved query without dropping failed predicates or replacing them with an empty filter. */
export function parseShowcaseQuery(input: unknown): ShowcaseQuery {
  const value = parseContract(plainRecordSchema, input, 'showcase query')
  const { kind, ...fields } = value
  switch (kind) {
    case 'entry': {
      const { referenceLabels, ...query } = fields
      return {
        kind,
        ...parseEntryQuery(query),
        referenceLabels: parseContract(
          queryReferenceLabelsSchema,
          referenceLabels,
          'query reference labels',
        ),
      }
    }
    case 'collection':
      return { kind, ...parseCollectionQuery(fields) }
    case 'tag':
      return { kind, ...parseTagQuery(fields) }
    default:
      return invalidInput('The showcase query kind is invalid.')
  }
}
const configurationFields = {
  name: v.pipe(v.string(), v.trim(), v.minLength(1)),
  query: v.pipe(v.unknown(), v.transform(parseShowcaseQuery)),
  layout: v.picklist(['horizontal', 'grid']),
  itemSize: v.picklist(['xs', 'sm', 'md', 'lg', 'xl']),
  openMode: v.picklist(['page', 'dialog']),
  limit: v.nullable(v.pipe(nonnegativeIntegerSchema, v.minValue(1))),
  isVisible: v.boolean(),
}
const configurationSchema = objectSchema(configurationFields)
/** Validate a complete saved section. Empty draft names remain drafts and cannot be persisted. */
export function parseShowcaseConfiguration(input: unknown): ShowcaseConfiguration {
  return parseContract(configurationSchema, input, 'showcase configuration')
}
/** Validate request-local targets and related baselines; the owner compares the final complete ID set inside its transaction. */
export function parseShowcaseChanges(input: unknown): ShowcaseChanges {
  const patch = objectSchema(exactPartialEntries(configurationFields))
  const value = parseContract(
    objectSchema({
      create: v.exactOptional(
        v.pipe(
          v.array(objectSchema({ key: nonemptyStringSchema, ...configurationFields })),
          v.readonly(),
        ),
      ),
      update: v.exactOptional(
        v.pipe(
          v.array(
            v.pipe(
              objectSchema({
                id: nonemptyStringSchema,
                changes: patch,
                expected: v.exactOptional(patch),
              }),
              v.check((item) => hasRelatedExpected(item.changes, item.expected)),
            ),
          ),
          v.readonly(),
        ),
      ),
      delete: v.exactOptional(
        v.pipe(
          v.array(
            objectSchema({
              id: nonemptyStringSchema,
              expected: v.exactOptional(configurationSchema),
            }),
          ),
          v.readonly(),
        ),
      ),
      order: v.exactOptional(
        objectSchema({
          items: v.pipe(
            v.array(
              v.union([
                objectSchema({ id: nonemptyStringSchema }),
                objectSchema({ key: nonemptyStringSchema }),
              ]),
            ),
            v.readonly(),
          ),
          expected: objectSchema({ order: v.pipe(v.array(nonemptyStringSchema), v.readonly()) }),
        }),
      ),
    }),
    input,
    'showcase changes',
  )
  const created = new Set(value.create?.map((item) => item.key))
  const removed = new Set(value.delete?.map((item) => item.id))
  if (
    !hasUniqueKeys(value.create ?? [], (item) => item.key) ||
    !hasUniqueKeys(value.update ?? [], (item) => item.id) ||
    !hasUniqueKeys(value.delete ?? [], (item) => item.id) ||
    value.update?.some((item) => removed.has(item.id))
  ) {
    return invalidInput('The showcase changes repeat or contradict a target.')
  }
  if (value.order) {
    if (
      !hasUniqueKeys(value.order.items, (item) =>
        'key' in item ? `key:${item.key}` : `id:${item.id}`,
      ) ||
      !hasUniqueKeys(value.order.expected.order, (id) => id)
    ) {
      return invalidInput('The showcase order contains duplicate targets.')
    }
    for (const item of value.order.items) {
      if ('key' in item ? !created.has(item.key) : removed.has(item.id)) {
        return invalidInput('The showcase order contains an invalid target.')
      }
    }
    for (const key of created) {
      if (!value.order.items.some((item) => 'key' in item && item.key === key)) {
        return invalidInput('The showcase order omits a new section.')
      }
    }
  }
  return value
}

/** Produce a fresh ordinary manual draft; the caller supplies its eventual nonempty title. */
export function createShowcaseDraft(): ShowcaseConfiguration {
  return {
    name: '',
    query: entryQuery(workTypes, []),
    layout: 'horizontal',
    itemSize: 'md',
    openMode: 'page',
    limit: 12,
    isVisible: true,
  }
}
function entryQuery(
  types: readonly [EntryType, ...EntryType[]],
  conditions: readonly EntryCondition[],
  sort: EntrySort = { type: 'scope' },
): Extract<ShowcaseQuery, { kind: 'entry' }> {
  return {
    kind: 'entry',
    scope: { type: 'library' },
    search: '',
    rules: [{ enabled: true, types: [...types], filter: { match: 'all', conditions } }],
    sort,
    referenceLabels: [],
  }
}
/** Return fresh English-base preset values. Runtime i18n resolves catalog display text before copying titles into drafts. */
export function createShowcasePresets(): readonly ShowcasePreset[] {
  const base = {
    layout: 'horizontal',
    itemSize: 'md',
    openMode: 'page',
    limit: 12,
    isVisible: true,
  } as const
  function preset(
    id: ShowcasePresetId,
    name: string,
    description: string,
    query: ShowcaseQuery,
    display: Partial<Pick<ShowcaseConfiguration, 'layout' | 'limit'>> = {},
  ): ShowcasePreset {
    return { id, name, description, configuration: { ...base, ...display, name, query } }
  }
  return [
    preset(
      'recently-used-works',
      'Recently used',
      'Works with actual use history.',
      entryQuery(workTypes, [{ field: 'lastActiveAt', op: 'present' }], {
        type: 'field',
        field: 'lastActiveAt',
        direction: 'desc',
      }),
    ),
    preset(
      'active-works',
      'In progress',
      'Works whose current status is in progress.',
      entryQuery(workTypes, [{ field: 'status', op: 'in', values: ['active'] }], {
        type: 'field',
        field: 'lastActiveAt',
        direction: 'desc',
      }),
    ),
    preset(
      'planned-works',
      'Planned',
      'Works planned for later.',
      entryQuery(workTypes, [{ field: 'status', op: 'in', values: ['planned'] }], {
        type: 'field',
        field: 'effectiveAddedDate',
        direction: 'desc',
      }),
    ),
    preset(
      'recently-added-works',
      'Recently added',
      'All works in added-date order.',
      entryQuery(workTypes, [], { type: 'field', field: 'effectiveAddedDate', direction: 'desc' }),
      { layout: 'grid', limit: null },
    ),
    preset(
      'favorite-works',
      'Favorite works',
      'Favorite games, anime, comics, and novels.',
      entryQuery(workTypes, [{ field: 'favorite', op: 'is', value: true }]),
      { layout: 'grid', limit: 24 },
    ),
    preset(
      'personal-rating-ranking',
      'By rating',
      'Rated works, including a rating of zero.',
      entryQuery(workTypes, [{ field: 'rating', op: 'present' }], {
        type: 'field',
        field: 'rating',
        direction: 'desc',
      }),
    ),
    preset(
      'favorite-characters',
      'Favorite characters',
      'Favorite characters.',
      entryQuery(['character'], [{ field: 'favorite', op: 'is', value: true }]),
      { layout: 'grid', limit: 24 },
    ),
    preset(
      'favorite-persons',
      'Favorite people',
      'Favorite people.',
      entryQuery(['person'], [{ field: 'favorite', op: 'is', value: true }]),
      { layout: 'grid', limit: 24 },
    ),
    preset(
      'favorite-organizations',
      'Favorite organizations',
      'Favorite organizations.',
      entryQuery(['organization'], [{ field: 'favorite', op: 'is', value: true }]),
      { layout: 'grid', limit: 24 },
    ),
    preset('collections', 'Collections', 'Collections in their saved order.', {
      kind: 'collection',
      search: '',
      sort: { type: 'scope' },
    }),
  ]
}
