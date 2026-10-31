/** @fileoverview Defines category-bound application search results and bounded plain-text excerpts. */

import * as v from 'valibot'
import type { CallOptions, ListOptions } from './execution'
import { objectSchema } from './schema'
import type { SearchTarget } from './ui/navigation'
import { nonnegativeIntegerSchema, parseContract } from './validation'

export const searchCategories = [
  'catalog',
  'notes',
  'annotations',
  'configurations',
  'themes',
  'fonts',
  'extensions',
  'pages',
  'preferences',
] as const
export type SearchCategory = (typeof searchCategories)[number]
/** Results remain correlated with the actual category argument; there is no synthetic all-category total. */
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
export type SearchIcon =
  | { readonly type: 'mdi'; readonly name: string }
  | { readonly type: 'extension'; readonly extensionId: string; readonly path: string }
export interface SearchItem<Category extends SearchCategory = SearchCategory> {
  readonly target: SearchTargetMap[Category]
  readonly title: string
  readonly context: string | null
  readonly excerpt: string | null
  readonly imageId: string | null
  readonly icon: SearchIcon | null
}
export interface SearchResult<Category extends SearchCategory = SearchCategory> {
  readonly items: readonly SearchItem<Category>[]
  readonly total: number
}
export interface SearchApi {
  /** Query one exact category in the current visible data, with a matching total; empty text yields an empty result without external work. */
  query<Category extends SearchCategory>(
    input: { readonly text: string; readonly category: Category },
    options: ListOptions,
    call?: CallOptions,
  ): Promise<SearchResult<Category>>
}
/** Validate a closed query and arbitrary legal interval without truncating or adding an all category. */
export function parseSearchQuery(input: unknown): {
  readonly text: string
  readonly category: SearchCategory
} {
  return parseContract(
    objectSchema({ text: v.string(), category: v.picklist(searchCategories) }),
    input,
    'application search query',
  )
}
/** Validate the 1–200 bounded read separately from its category/text identity. */
export function parseSearchOptions(input: unknown): ListOptions {
  return parseContract(
    objectSchema({
      offset: nonnegativeIntegerSchema,
      limit: v.pipe(nonnegativeIntegerSchema, v.minValue(1), v.maxValue(200)),
    }),
    input,
    'application search interval',
  )
}
/** Bound an already extracted plain-text excerpt to 160 UTF-16 units, ending only at a full extended grapheme boundary. */
export function truncateSearchExcerpt(text: string): string {
  if (text.length <= 160) {
    return text
  }
  let end = 0
  for (const segment of new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(text)) {
    const next = segment.index + segment.segment.length
    if (next > 160) {
      break
    }
    end = next
  }
  return text.slice(0, end)
}
