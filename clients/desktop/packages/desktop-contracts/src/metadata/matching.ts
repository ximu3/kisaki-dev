/** @fileoverview Defines matching field vocabulary and validates ordered profile rules. */

import * as v from 'valibot'
import { unique, parseValue } from '../validation'
import type { PartType, EntryType } from '../library/catalog'
import { partIdentificationEntries, identificationEntries } from './fields'
import { metadataPartKinds } from './objects'
import { entryTypes } from '../library/catalog'
import type { IdentificationFields, PartIdentificationFields } from './fields'
import type { NonEmptyArray } from '../operations'
import type { MetadataPartKey, MetadataPartType } from './objects'

/** Creates an ordered rule-list schema with nonempty, distinct field selections in each rule. */
export function rules(fields: readonly string[]) {
  const field = v.picklist(fields)
  return v.array(
    v.strictObject({
      fields: v.pipe(
        v.tupleWithRest([field], field),
        v.check((fields) => unique(fields, (field) => field)),
      ),
    }),
  )
}

/**
 * Returns a part kind's original-evidence fields and supported contextual matching fields.
 *
 * For comic chapters, volumeNumberLabel is a scoped matching input rather than a metadata field.
 */
export function getPartMatchingFields<T extends PartType>(
  type: T,
): readonly PartMatchingField<T>[] {
  return [
    ...Object.keys(partIdentificationEntries(type)),
    ...(type === 'comicChapter' ? ['volumeNumberLabel'] : []),
  ] as PartMatchingField<T>[]
}

/**
 * Parses fallback rules for part slots compatible with the root kind.
 *
 * An omitted or empty rule list means no fallback for that slot.
 */
export function parsePartMatchingRules<T extends EntryType>(
  root: T,
  input: unknown,
): PartMatchingRules<T> {
  const entries = Object.fromEntries(
    Object.entries(metadataPartKinds[root]).map(([slot, type]) => [
      slot,
      v.exactOptional(rules(getPartMatchingFields(type))),
    ]),
  )
  return parseValue(
    v.strictObject(entries),
    input,
    'Invalid part matching rules',
  ) as PartMatchingRules<T>
}

/** Parses ordered entry-matching and root-compatible part-matching fallback rules. */
export function parseMetadataMatchingRules<T extends EntryType>(
  root: T,
  input: unknown,
): MetadataMatchingRules<T> {
  const entries = Object.fromEntries(
    entryTypes.map((type) => [
      type,
      v.exactOptional(rules(Object.keys(identificationEntries(type)))),
    ]),
  )
  const parts = Object.fromEntries(
    Object.entries(metadataPartKinds[root]).map(([slot, type]) => [
      slot,
      v.exactOptional(rules(getPartMatchingFields(type))),
    ]),
  )
  return parseValue(
    v.strictObject({ ...entries, ...parts }),
    input,
    'Invalid metadata matching rules',
  ) as MetadataMatchingRules<T>
}

/** Original identification field available for matching an entry kind. */
export type EntryMatchingField<T extends EntryType> = Extract<keyof IdentificationFields<T>, string>

/** Original or supported contextual field available for matching a part kind. */
export type PartMatchingField<T extends PartType> =
  | Extract<keyof PartIdentificationFields<T>, string>
  | (T extends 'comicChapter' ? 'volumeNumberLabel' : never)

/**
 * Nonempty field combination evaluated as one fallback matching rule.
 *
 * Every field requires an original comparable value. Only zero matches advances to the next rule.
 */
export interface MatchingRule<Field extends PropertyKey> {
  readonly fields: NonEmptyArray<Field>
}

/** Ordered fallback rule lists for the root kind's supported part slots. */
export type PartMatchingRules<T extends EntryType> = {
  readonly [K in MetadataPartKey<T>]?: readonly MatchingRule<
    PartMatchingField<MetadataPartType<T, K>>
  >[]
}

/** Ordered entry and part fallback rules used while composing a metadata graph. */
export type MetadataMatchingRules<T extends EntryType> = {
  readonly [K in EntryType]?: readonly MatchingRule<EntryMatchingField<K>>[]
} & PartMatchingRules<T>
