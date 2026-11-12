/** @fileoverview Defines complete entry queries, retained references and saved dynamic rules. */

import type { EntryRule } from './conditions'
import type { EntrySort } from './sort'
import type { EntryRef } from '../catalog'
import * as v from 'valibot'
import { id, parseValue, text, nonemptyText, unique } from '../../validation'
import { parseEntryRule } from './conditions'
import { parseEntrySort } from './sort'
import { entryRefSchema } from '../catalog'
import { DesktopError } from '../../errors'

/** Fixed query entrance intersected with rules, search and the caller's actual visibility. */
export type EntryScope =
  | { readonly type: 'library' | 'favorites' | 'unclassified' }
  | { readonly type: 'collection' | 'tag' | 'note'; readonly id: string }

/**
 * Reusable entry result-set definition, independent of paging, projected fields and view
 * components.
 */
export interface EntryQuery {
  readonly scope: EntryScope
  readonly search: string
  readonly rules: readonly EntryRule[]
  readonly sort: EntrySort
}

/**
 * Last-saved display name for a referenced query target.
 *
 * The label supports display when the target cannot be resolved; it grants no lookup authority and
 * does not establish identity.
 */
export interface QueryReferenceLabel {
  readonly target: EntryRef | { readonly type: 'tag' | 'collection' | 'note'; readonly id: string }
  readonly name: string
}

/** Saved dynamic membership definition evaluated over the library with an explicit sort. */
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

const queryRulesSchema = v.array(v.pipe(v.unknown(), v.transform(parseEntryRule)))

/**
 * Parses the complete query definition and validates sorting against its enabled entry types.
 *
 * Empty or entirely disabled rules remain valid definitions of an empty result set.
 */
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

/** Parses display-name snapshots and requires each target identity to occur once. */
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

/** Parses a saved membership definition, its explicit sort and display-only reference labels. */
export function parseDynamicRules(input: unknown): DynamicRules {
  const value = parseValue(
    v.strictObject({
      search: text,
      rules: queryRulesSchema,
      sort: v.unknown(),
      referenceLabels: v.pipe(v.unknown(), v.transform(parseQueryReferenceLabels)),
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
