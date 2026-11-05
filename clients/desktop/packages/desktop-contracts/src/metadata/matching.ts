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

/** Part rule fields have one owner; volumeNumberLabel is only a scoped comic-chapter matching input, never metadata. */
export function getPartMatchingFields<T extends PartType>(
  type: T,
): readonly PartMatchingField<T>[] {
  return [
    ...Object.keys(partIdentificationEntries(type)),
    ...(type === 'comicChapter' ? ['volumeNumberLabel'] : []),
  ] as PartMatchingField<T>[]
}

/** Validate root-compatible part slots; missing or empty rule arrays explicitly mean no fallback. */
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

/** Validate the profile's entry and root-compatible part fallback lists; there are no processors or inline policies here. */
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

export type EntryMatchingField<T extends EntryType> = Extract<keyof IdentificationFields<T>, string>

export type PartMatchingField<T extends PartType> =
  | Extract<keyof PartIdentificationFields<T>, string>
  | (T extends 'comicChapter' ? 'volumeNumberLabel' : never)

/** Every field must have an original comparable value. Only zero matches advances to the next ordered fallback rule. */
export interface MatchingRule<Field extends PropertyKey> {
  readonly fields: NonEmptyArray<Field>
}

export type PartMatchingRules<T extends EntryType> = {
  readonly [K in MetadataPartKey<T>]?: readonly MatchingRule<
    PartMatchingField<MetadataPartType<T, K>>
  >[]
}

export type MetadataMatchingRules<T extends EntryType> = {
  readonly [K in EntryType]?: readonly MatchingRule<EntryMatchingField<K>>[]
} & PartMatchingRules<T>
