/** @fileoverview Defines bounded application search and category-correlated native navigation results. */

import type { SearchTarget } from './ui/navigation'
import type { ListOptions, CallOptions } from './operations'
import * as v from 'valibot'
import {
  nonemptyText,
  parseExternalValue,
  parseValue,
  text,
  nonnegativeInteger,
  id,
} from './validation'
import { parseId } from '@kisaki3/extension-distribution/metadata'
import { parsePackagePath } from '@kisaki3/extension-distribution/manifest'
import { parseSearchTarget } from './ui/navigation'
import { DesktopError } from './errors'

export const searchCategories = Object.freeze([
  'catalog',
  'notes',
  'annotations',
  'configurations',
  'themes',
  'fonts',
  'extensions',
  'pages',
  'preferences',
] as const)

export type SearchCategory = (typeof searchCategories)[number]

export interface SearchTargetMap {
  readonly catalog: Extract<SearchTarget, { type: 'entry' | 'part' | 'collection' | 'tag' }>
  readonly notes: Extract<SearchTarget, { type: 'note' }>
  readonly annotations: Extract<SearchTarget, { type: 'annotation' }>
  readonly configurations: Extract<
    SearchTarget,
    { type: 'metadataProfile' | 'scanConfig' | 'launchConfig' }
  >
  readonly themes: Extract<SearchTarget, { type: 'theme' }>
  readonly fonts: Extract<SearchTarget, { type: 'font' }>
  readonly extensions: Extract<SearchTarget, { type: 'extension' }>
  readonly pages: Extract<SearchTarget, { type: 'page' }>
  readonly preferences: Extract<SearchTarget, { type: 'preference' }>
}

/** Runtime display resources retain their actual extension owner; search results never hold read-resource leases. */
export type SearchIcon =
  | { readonly type: 'mdi'; readonly name: string }
  | { readonly type: 'extension'; readonly extensionId: string; readonly path: string }

export interface SearchQuery<T extends SearchCategory = SearchCategory> {
  readonly text: string
  readonly category: T
}

export interface SearchItem<T extends SearchCategory = SearchCategory> {
  readonly target: SearchTargetMap[T]
  readonly title: string
  readonly context: string | null
  readonly excerpt: string | null
  readonly imageId: string | null
  readonly icon: SearchIcon | null
}

export interface SearchResult<T extends SearchCategory = SearchCategory> {
  readonly items: readonly SearchItem<T>[]
  readonly total: number
}

export interface SearchApi {
  /** One category per request. Empty text succeeds with zero results; failures never masquerade as an empty search. */
  query<T extends SearchCategory>(
    input: SearchQuery<T>,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<SearchResult<T>>
}

const targetTypes = {
  catalog: ['entry', 'part', 'collection', 'tag'],
  notes: ['note'],
  annotations: ['annotation'],
  configurations: ['metadataProfile', 'scanConfig', 'launchConfig'],
  themes: ['theme'],
  fonts: ['font'],
  extensions: ['extension'],
  pages: ['page'],
  preferences: ['preference'],
} satisfies Record<SearchCategory, readonly SearchTarget['type'][]>

const icon = v.variant('type', [
  v.strictObject({ type: v.literal('mdi'), name: nonemptyText }),
  v.strictObject({
    type: v.literal('extension'),
    extensionId: v.pipe(
      v.unknown(),
      v.transform((value) => parseExternalValue(parseId, value, 'Invalid extension identity')),
    ),
    path: v.pipe(
      v.unknown(),
      v.transform((value) =>
        parseExternalValue(parsePackagePath, value, 'Invalid extension icon path'),
      ),
    ),
  }),
])

/** Category/text are mandatory; all is a UI composition, never a query category. */
export function parseSearchQuery(input: unknown): SearchQuery {
  return parseValue(
    v.strictObject({ text, category: v.picklist(searchCategories) }),
    input,
    'Invalid application search',
  )
}

/** Validate complete totals and the exact category/target association, without substituting a source/URL for a native target. */
export function parseSearchResult<T extends SearchCategory>(
  category: T,
  input: unknown,
): SearchResult<T>

export function parseSearchResult(category: SearchCategory, input: unknown): SearchResult {
  const value = parseValue(
    v.strictObject({
      total: nonnegativeInteger,
      items: v.array(
        v.strictObject({
          target: v.pipe(v.unknown(), v.transform(parseSearchTarget)),
          title: text,
          context: v.nullable(text),
          excerpt: v.nullable(v.pipe(text, v.maxLength(160))),
          imageId: v.nullable(id),
          icon: v.nullable(icon),
        }),
      ),
    }),
    input,
    'Invalid search result',
  )
  const allowed: readonly SearchTarget['type'][] = targetTypes[category]
  if (
    value.total < value.items.length ||
    value.items.some((item) => !allowed.includes(item.target.type))
  ) {
    throw new DesktopError('InvalidInput', 'Search result does not match its category or total')
  }

  return value
}

export type { SearchTarget } from './ui/navigation'
