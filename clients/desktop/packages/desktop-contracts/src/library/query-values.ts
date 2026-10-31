/** @fileoverview Defines closed query operands, inclusive bounds, and exact set normalization. */

import * as v from 'valibot'
import { objectSchema } from '../schema'
import {
  matchesAbsoluteDateRange,
  monthDateSchema,
  yearDateSchema,
  type Bounds,
  type MonthDate,
  type YearDate,
} from '../date'
import { nonemptyStringSchema, safeIntegerSchema } from '../validation'

/** A true displayed group identity, independent of its title and folding state. */
export type EntryGroupKey =
  { readonly type: 'collection'; readonly id: string } | { readonly type: 'unclassified' }
export const entryGroupKeySchema = v.union([
  objectSchema({ type: v.literal('collection'), id: nonemptyStringSchema }),
  objectSchema({ type: v.literal('unclassified') }),
])

/** Whether an applicable nullable value is recorded; zero and false remain actual values. */
export type Presence = { readonly op: 'present' | 'absent' }
/** An inclusive numeric range; individual fields additionally enforce their own unit and bounds. */
export interface NumberTest {
  readonly op: 'range'
  readonly bounds: Bounds<number>
}
/** Set membership applies to a field's actual visible facts; selected operands cannot be empty. */
export type SetTest<Value> =
  | { readonly op: 'any' | 'all' | 'none'; readonly values: readonly [Value, ...Value[]] }
  | { readonly op: 'empty' | 'notEmpty' }
/** Exclusion is the full complement, retaining null unless null is explicitly excluded. */
export interface EnumTest<Value> {
  readonly op: 'in' | 'notIn'
  readonly values: readonly [Value, ...Value[]]
}
/** Plain text, never a regular expression. Exact cup-size comparisons preserve the source text. */
export interface TextTest {
  readonly op: 'equals' | 'contains'
  readonly value: string
}
/** Date predicates compare known components and ranges without filling unknown values. */
export type DateTest =
  | Presence
  | { readonly op: 'absoluteRange'; readonly bounds: Bounds<YearDate> }
  | {
      readonly op: 'componentRange'
      readonly component: 'year' | 'month' | 'day'
      readonly bounds: Bounds<number>
    }
  | {
      readonly op: 'componentPresent' | 'componentAbsent'
      readonly component: 'year' | 'month' | 'day'
    }
/** A cyclic month/day range, used only for the birthday fields that support it. */
export interface MonthDayTest {
  readonly op: 'monthDayRange'
  readonly from: MonthDate
  readonly to: MonthDate
}

export const presenceSchema = objectSchema({ op: v.picklist(['present', 'absent']) })
export const textTestFields = {
  op: v.picklist(['equals', 'contains']),
  value: nonemptyStringSchema,
}
export const textTestSchema = objectSchema(textTestFields)

/** Compose an inclusive range for a declared scalar domain. Both absent and reversed bounds fail. */
export function boundsSchema<Schema extends v.GenericSchema<number>>(schema: Schema) {
  return v.pipe(
    v.union([
      objectSchema({ min: schema, max: v.exactOptional(schema) }),
      objectSchema({ min: v.exactOptional(schema), max: schema }),
    ]),
    v.check(
      (value) => value.min === undefined || value.max === undefined || value.min <= value.max,
    ),
  )
}

export const yearBoundsSchema = v.pipe(
  v.union([
    objectSchema({ min: yearDateSchema, max: v.exactOptional(yearDateSchema) }),
    objectSchema({ min: v.exactOptional(yearDateSchema), max: yearDateSchema }),
  ]),
  v.check((value) => {
    try {
      matchesAbsoluteDateRange(null, value)
      return true
    } catch {
      return false
    }
  }),
)

/** Build a nonempty exact-value set; repeated selections normalize without changing first-seen order. */
export function selectedValuesSchema<Schema extends v.GenericSchema>(schema: Schema) {
  return v.pipe(
    v.tupleWithRest([schema], schema),
    v.transform((values) => distinctValues(values)),
    v.readonly(),
  )
}

/** Create the finite set-test branches, including explicit empty/notEmpty without unused operands. */
export function setTestSchema<Schema extends v.GenericSchema>(schema: Schema) {
  return v.union([
    objectSchema({ op: v.picklist(['any', 'all', 'none']), values: selectedValuesSchema(schema) }),
    objectSchema({ op: v.picklist(['empty', 'notEmpty']) }),
  ])
}

/** Create inclusion/exclusion for an actual declared enum or nullable enum. */
export function enumTestSchema<Schema extends v.GenericSchema>(schema: Schema) {
  return objectSchema(enumTestFields(schema))
}

/** Reuse the exact enum operand fields in a condition that also declares its actual business field. */
export function enumTestFields<Schema extends v.GenericSchema>(schema: Schema) {
  return { op: v.picklist(['in', 'notIn']), values: selectedValuesSchema(schema) }
}

/** Date grammar with owner-supplied closed fields; it does not carry a timezone or query runtime. */
export function dateTestSchemas<Entries extends v.ObjectEntries>(entries: Entries) {
  return [
    objectSchema({ ...entries, op: v.literal('absoluteRange'), bounds: yearBoundsSchema }),
    objectSchema({
      ...entries,
      op: v.literal('componentRange'),
      component: v.literal('year'),
      bounds: boundsSchema(safeIntegerSchema),
    }),
    objectSchema({
      ...entries,
      op: v.literal('componentRange'),
      component: v.literal('month'),
      bounds: boundsSchema(v.pipe(safeIntegerSchema, v.minValue(1), v.maxValue(12))),
    }),
    objectSchema({
      ...entries,
      op: v.literal('componentRange'),
      component: v.literal('day'),
      bounds: boundsSchema(v.pipe(safeIntegerSchema, v.minValue(1), v.maxValue(31))),
    }),
    objectSchema({
      ...entries,
      op: v.picklist(['componentPresent', 'componentAbsent']),
      component: v.picklist(['year', 'month', 'day']),
    }),
  ] as const
}

export const dateTestSchema = v.union([...dateTestSchemas({}), presenceSchema])
export const monthDayTestSchema = objectSchema({
  op: v.literal('monthDayRange'),
  from: monthDateSchema,
  to: monthDateSchema,
})

function distinctValues<Value>(values: readonly [Value, ...Value[]]): readonly [Value, ...Value[]] {
  const result: [Value, ...Value[]] = [values[0]]
  const keys = new Set([JSON.stringify(values[0])])
  for (const value of values.slice(1)) {
    const key = JSON.stringify(value)
    if (!keys.has(key)) {
      keys.add(key)
      result.push(value)
    }
  }
  return result
}
