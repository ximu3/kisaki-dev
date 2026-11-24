import * as v from 'valibot'
import { fromParser, id, parseValue, text, nonemptyText, unique } from '../../validation'
import { parseEntryRule, type EntryRule } from './conditions'
import { parseEntrySort, type EntrySort } from './sort'
import { entryRefSchema, type EntryRef } from '../catalog'
import { DesktopError } from '../../errors'

export type EntryScope =
  | { readonly type: 'library' | 'favorites' | 'unclassified' }
  | { readonly type: 'collection' | 'tag' | 'note'; readonly id: string }

export interface EntryQuery {
  readonly scope: EntryScope
  readonly search: string
  readonly rules: readonly EntryRule[]
  readonly sort: EntrySort
}

export interface QueryReferenceLabel {
  readonly target: EntryRef | { readonly type: 'tag' | 'collection' | 'note'; readonly id: string }
  readonly name: string
}

export interface DynamicRules {
  readonly search: string
  readonly rules: readonly EntryRule[]
  readonly sort: Exclude<EntrySort, { readonly type: 'scope' }>
  readonly referenceLabels: readonly QueryReferenceLabel[]
}

const entryScopeSchema = v.union([
  v.strictObject({ type: v.picklist(['library', 'favorites', 'unclassified']) }),
  v.strictObject({ type: v.picklist(['collection', 'tag', 'note']), id }),
])

const queryRulesSchema = v.array(fromParser(parseEntryRule))

export function parseEntryQuery(input: unknown): EntryQuery {
  const value = parseValue(
    v.strictObject({
      scope: entryScopeSchema,
      search: text,
      rules: queryRulesSchema,
      sort: v.unknown(),
    }),
    input,
    'Invalid entry query',
  )

  const types = value.rules.filter((rule) => rule.enabled).flatMap((rule) => rule.types)
  return { ...value, sort: parseEntrySort(value.sort, types) }
}

export function parseQueryReferenceLabels(input: unknown): readonly QueryReferenceLabel[] {
  const label = v.strictObject({
    target: v.union([
      entryRefSchema,
      v.strictObject({ type: v.picklist(['collection', 'tag', 'note']), id }),
    ]),
    name: nonemptyText,
  })
  return parseValue(
    v.pipe(
      v.array(label),
      v.check((labels) =>
        unique(labels, (item) => JSON.stringify([item.target.type, item.target.id])),
      ),
    ),
    input,
    'Invalid saved query reference labels',
  )
}

export function parseDynamicRules(input: unknown): DynamicRules {
  const value = parseValue(
    v.strictObject({
      search: text,
      rules: queryRulesSchema,
      sort: v.unknown(),
      referenceLabels: fromParser(parseQueryReferenceLabels),
    }),
    input,
    'Invalid dynamic rules',
  )

  const sort = parseEntrySort(
    value.sort,
    value.rules.filter((rule) => rule.enabled).flatMap((rule) => rule.types),
  )
  if (sort.type === 'scope') {
    throw new DesktopError('InvalidInput', 'Dynamic rules require an explicit sort')
  }

  return { ...value, sort }
}
