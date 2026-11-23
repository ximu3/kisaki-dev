import * as v from 'valibot'
import { unique, parseValue } from '../validation'
import {
  partIdentificationEntries,
  identificationEntries,
  type IdentificationFields,
  type PartIdentificationFields,
} from './fields'
import { metadataPartKinds, type MetadataPartKey, type MetadataPartType } from './objects'
import { entryTypes, type PartType, type EntryType } from '../library/catalog'
import type { NonEmptyArray } from '../operations'

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

/** For comic chapters, volumeNumberLabel belongs to scoped matching rather than field adoption. */
export function getPartMatchingFields<T extends PartType>(
  type: T,
): readonly PartMatchingField<T>[] {
  return [
    ...Object.keys(partIdentificationEntries(type)),
    ...(type === 'comicChapter' ? ['volumeNumberLabel'] : []),
  ] as PartMatchingField<T>[]
}

/** Omission or an empty rule list means no fallback for that slot. */
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

/**
 * Every selected field requires an original comparable value. Only zero matches advances to the
 * next rule.
 */
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
