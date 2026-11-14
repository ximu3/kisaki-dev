/** @fileoverview Defines list intervals, grouping, locate inputs and internally consistent replies. */

import type { EntryQuery } from './definition'
import { parseValue, nonnegativeInteger, unique, id, intervalEntries } from '../../validation'
import * as v from 'valibot'
import { parseEntryListItem, projectionSchema, checkProjection } from './projections'
import { DesktopError, parseErrorSummary } from '../../errors'
import type { EntryRef } from '../catalog'
import type { EntryProjectionField, EntryListItem } from './projections'
import type { ErrorSummary } from '../../errors'

/**
 * Parses a list reply against an already parsed query and interval.
 *
 * Checks entry types, unique identities and the exact item count implied by total, offset and
 * limit. An empty set of enabled types requires a zero total.
 */
export function parseEntryListResult(
  input: unknown,
  query: EntryQuery,
  options: EntryListOptions,
): EntryListResult {
  const value = parseValue(
    v.strictObject({
      total: nonnegativeInteger,
      items: v.array(
        v.pipe(
          v.unknown(),
          v.transform((item) => parseEntryListItem(item, options.fields)),
        ),
      ),
    }),
    input,
    'Invalid entry list result',
  )

  const types = new Set(query.rules.filter((rule) => rule.enabled).flatMap((rule) => rule.types))
  if (
    value.items.some((item) => !types.has(item.type)) ||
    !unique(value.items, (item) => item.id) ||
    value.items.length !== Math.min(options.limit, Math.max(0, value.total - options.offset)) ||
    (types.size === 0 && value.total !== 0)
  ) {
    throw new DesktopError(
      'InvalidInput',
      'Entry interval does not match its complete result count or type range',
    )
  }

  return value
}

/**
 * Parses a locate reply and verifies its centered interval and target at the reported index.
 *
 * Null represents a target outside the query result.
 */
export function parseEntryLocateResult(
  input: unknown,
  query: EntryQuery,
  target: EntryRef,
  options: EntryLocateOptions,
): EntryLocateResult | null {
  if (input === null) {
    return null
  }

  const value = parseValue(
    v.strictObject({
      index: nonnegativeInteger,
      offset: nonnegativeInteger,
      total: nonnegativeInteger,
      items: v.array(v.unknown()),
    }),
    input,
    'Invalid located entry result',
  )
  const offset = entryLocateOffset(value.index, value.total, options.limit)
  if (value.offset !== offset) {
    throw new DesktopError('InvalidInput', 'Located interval has an inconsistent offset')
  }

  const interval = parseEntryListResult({ total: value.total, items: value.items }, query, {
    ...options,
    offset,
  })
  const found = interval.items[value.index - offset]
  if (!found || found.id !== target.id || found.type !== target.type) {
    throw new DesktopError(
      'InvalidInput',
      'Located interval does not contain its target at the reported index',
    )
  }

  return { ...interval, index: value.index, offset }
}

/**
 * Parses unique group results ending with the unclassified group.
 *
 * Preserves individual group failures and the independent deduplicated total; overlapping group
 * counts cannot be summed into that total.
 */
export function parseEntryGroupsResult(input: unknown): EntryGroupsResult {
  const key = v.union([
    v.strictObject({ type: v.literal('collection'), id }),
    v.strictObject({ type: v.literal('unclassified') }),
  ])
  const group = v.variant('status', [
    v.strictObject({ key, status: v.literal('ready'), count: nonnegativeInteger }),
    v.strictObject({
      key,
      status: v.literal('failed'),
      error: v.pipe(v.unknown(), v.transform(parseErrorSummary)),
    }),
  ])
  const value = parseValue(
    v.strictObject({
      total: nonnegativeInteger,
      groups: v.pipe(
        v.array(group),
        v.check((groups) =>
          unique(groups, (group) =>
            group.key.type === 'collection'
              ? JSON.stringify(['collection', group.key.id])
              : 'unclassified',
          ),
        ),
      ),
    }),
    input,
    'Invalid entry groups result',
  )
  if (value.groups.at(-1)?.key.type !== 'unclassified') {
    throw new DesktopError('InvalidInput', 'Entry groups must end with the unclassified group')
  }

  return value
}

/** Group identity independent of its display name and a view's expanded state. */
export type EntryGroupKey =
  { readonly type: 'collection'; readonly id: string } | { readonly type: 'unclassified' }

/** Requested entry interval, projected fields and optional group restriction. */
export interface EntryListOptions {
  /** Zero-based start in the selected result set. */
  readonly offset: number
  /** Maximum interval length, from 1 through 200. */
  readonly limit: number
  readonly fields?: readonly EntryProjectionField[]
  readonly group?: EntryGroupKey
}

/** Requested interval size, projected fields and group restriction around a located entry. */
export interface EntryLocateOptions {
  /** Maximum interval length, from 1 through 200. */
  readonly limit: number
  readonly fields?: readonly EntryProjectionField[]
  readonly group?: EntryGroupKey
}

/** Entry interval and complete result count read from one snapshot. */
export interface EntryListResult {
  readonly items: readonly EntryListItem[]
  readonly total: number
}

/** Entry interval containing a target and its positions within the complete result set. */
export interface EntryLocateResult extends EntryListResult {
  /** Zero-based target position in the complete result set. */
  readonly index: number
  /** Zero-based position of the first returned item in the complete result set. */
  readonly offset: number
}

/** One group's matching count or the failure that prevented its evaluation. */
export type EntryGroupResult =
  | { readonly key: EntryGroupKey; readonly status: 'ready'; readonly count: number }
  | { readonly key: EntryGroupKey; readonly status: 'failed'; readonly error: ErrorSummary }

/** Ordered group results with an independent deduplicated entry total. */
export interface EntryGroupsResult {
  readonly total: number
  readonly groups: readonly EntryGroupResult[]
}

/** Collection or unclassified group identity used by grouped library listings. */
export const groupSchema = v.union([
  v.strictObject({ type: v.literal('collection'), id }),
  v.strictObject({ type: v.literal('unclassified') }),
])

/**
 * Parses an interval and checks requested fields against a previously parsed query.
 *
 * A field unsupported by every enabled entry type is rejected.
 */
export function parseEntryListOptions(input: unknown, query: EntryQuery): EntryListOptions {
  const value = parseValue(
    v.strictObject({
      ...intervalEntries,
      fields: v.exactOptional(projectionSchema),
      group: v.exactOptional(groupSchema),
    }),
    input,
    'Invalid entry list options',
  )
  checkProjection(value.fields, query)
  return value
}

/** Parses locate options with the same projection and group rules as a list request. */
export function parseEntryLocateOptions(input: unknown, query: EntryQuery): EntryLocateOptions {
  const value = parseValue(
    v.strictObject({
      limit: intervalEntries.limit,
      fields: v.exactOptional(projectionSchema),
      group: v.exactOptional(groupSchema),
    }),
    input,
    'Invalid entry locate options',
  )
  checkProjection(value.fields, query)
  return value
}

/**
 * Computes an interval offset that centers an existing target when possible and fills the final
 * interval.
 *
 * Rejects an index outside the result set; callers represent an absent target with null.
 */
export function entryLocateOffset(index: number, total: number, limit: number): number {
  const value = parseValue(
    v.strictObject({
      index: nonnegativeInteger,
      total: nonnegativeInteger,
      limit: intervalEntries.limit,
    }),
    { index, total, limit },
  )
  if (value.index >= value.total) {
    throw new DesktopError('InvalidInput', 'The located index must belong to the result')
  }

  return Math.max(0, Math.min(index - Math.floor(limit / 2), total - limit))
}
