import type { EntryQuery } from './definition'
import {
  fromParser,
  parseValue,
  nonnegativeInteger,
  unique,
  id,
  intervalEntries,
} from '../../validation'
import * as v from 'valibot'
import {
  parseEntryListItem,
  projectionSchema,
  checkProjection,
  type EntryProjectionField,
  type EntryListItem,
} from './projections'
import { DesktopError, parseErrorSummary, type ErrorSummary } from '../../errors'
import type { EntryRef } from '../catalog'

export function parseEntryListResult(
  input: unknown,
  query: EntryQuery,
  options: EntryListOptions,
): EntryListResult {
  const value = parseValue(
    v.strictObject({
      total: nonnegativeInteger,
      items: v.array(fromParser((item) => parseEntryListItem(item, options.fields))),
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
      error: fromParser(parseErrorSummary),
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

export type EntryGroupKey =
  | { readonly type: 'collection'; readonly id: string }
  | { readonly type: 'unclassified' }

export interface EntryListOptions {
  readonly offset: number
  readonly limit: number
  readonly fields?: readonly EntryProjectionField[]
  readonly group?: EntryGroupKey
}

export interface EntryLocateOptions {
  readonly limit: number
  readonly fields?: readonly EntryProjectionField[]
  readonly group?: EntryGroupKey
}

export interface EntryListResult {
  readonly items: readonly EntryListItem[]
  readonly total: number
}

export interface EntryLocateResult extends EntryListResult {
  readonly index: number
  readonly offset: number
}

export type EntryGroupResult =
  | { readonly key: EntryGroupKey; readonly status: 'ready'; readonly count: number }
  | { readonly key: EntryGroupKey; readonly status: 'failed'; readonly error: ErrorSummary }

export interface EntryGroupsResult {
  readonly total: number
  readonly groups: readonly EntryGroupResult[]
}

export const groupSchema = v.union([
  v.strictObject({ type: v.literal('collection'), id }),
  v.strictObject({ type: v.literal('unclassified') }),
])

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
