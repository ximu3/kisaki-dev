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
  readonly limit: number | null

  readonly openMode: 'page' | 'dialog'
  readonly isVisible: boolean
}

export interface ShowcaseSection extends Omit<ShowcaseFields, 'query'> {
  readonly id: string
  readonly query: StoredDefinition<ShowcaseQuery>
  readonly sortOrder: number
  readonly createdAt: number
  readonly updatedAt: number
}

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
  list(call?: CallOptions): Promise<readonly ShowcaseSection[]>

  get(id: string, call?: CallOptions): Promise<ShowcaseSection | null>

  listPresets(call?: CallOptions): Promise<readonly ShowcasePreset[]>

  create(input: ShowcaseFields, call?: CallOptions): Promise<ShowcaseSection>

  createMany(
    input: NonEmptyArray<ShowcaseFields>,
    call?: CallOptions,
  ): Promise<readonly ShowcaseSection[]>

  update(id: string, input: ShowcaseUpdate, call?: CallOptions): Promise<ShowcaseSection>

  delete(id: string, call?: CallOptions): Promise<void>

  reorder(input: ReorderInput, call?: CallOptions): Promise<void>
}

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

export function parseShowcaseFields(input: unknown): ShowcaseFields {
  return parseValue(v.strictObject(fields), input, 'Invalid showcase configuration')
}

export function parseShowcaseCreateMany(input: unknown): NonEmptyArray<ShowcaseFields> {
  const section = v.strictObject(fields)
  return parseValue(v.tupleWithRest([section], section), input, 'Invalid showcase creation batch')
}

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
