/** @fileoverview Validates ordered matching fields and compares original evidence without promoting it to identity. */

import * as v from 'valibot'
import { parseValue, unique } from '../validation'
import { entryTypes } from '../library/catalog'
import type { EntryType, PartType } from '../library/catalog'
import { fileNumberKey } from '../library/file-recognition'
import {
  identificationEntries,
  metadataNameKey,
  parseIdentificationFields,
  parsePartIdentificationFields,
  partIdentificationEntries,
} from './fields'
import type { IdentificationFields, PartIdentificationFields } from './fields'
import { metadataPartKinds } from './values'
import type {
  EntryMatchingField,
  MatchingRule,
  MetadataMatchingRules,
  PartMatchingField,
  PartMatchingRules,
} from './values'

function rules(fields: readonly string[]) {
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

/** A missing component makes the entire composite key unavailable, never a wildcard that matches another object. */
export type MatchingComparison = 'unavailable' | 'equal' | 'different'

function comparisonValue(field: string, value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (field === 'name' || field === 'originalName') {
    return typeof value === 'string' && value.trim() ? metadataNameKey(value) : undefined
  }
  if (field === 'aliases') {
    if (!Array.isArray(value) || value.length === 0) {
      return undefined
    }

    // Aliases are compared as complete normalized sets; a shared fragment does not become an identity claim.
    return JSON.stringify([...new Set((value as string[]).map(metadataNameKey))].sort())
  }
  if (field === 'numberLabel' || field === 'volumeNumberLabel') {
    return typeof value === 'string' && value.trim() ? fileNumberKey(value) : undefined
  }
  if (typeof value === 'object' && ('year' in value || 'month' in value || 'day' in value)) {
    const date = value as { year?: number; month?: number; day?: number }
    return JSON.stringify([date.year ?? null, date.month ?? null, date.day ?? null])
  }

  return JSON.stringify(value)
}

function compareFields(fields: readonly string[], left: object, right: object): MatchingComparison {
  let equal = true
  const a = left as Record<string, unknown>
  const b = right as Record<string, unknown>
  for (const field of fields) {
    const first = comparisonValue(field, a[field])
    const second = comparisonValue(field, b[field])
    if (first === undefined || second === undefined) {
      return 'unavailable'
    }
    if (first !== second) {
      equal = false
    }
  }

  return equal ? 'equal' : 'different'
}

/** Compare one explicitly selected original-entry rule; uniqueness, conflicts and strong-identity adoption are separate decisions. */
export function compareEntryIdentification<T extends EntryType>(
  type: T,
  rule: MatchingRule<EntryMatchingField<T>>,
  left: IdentificationFields<T>,
  right: IdentificationFields<T>,
): MatchingComparison {
  const parsed = parseValue(rules(Object.keys(identificationEntries(type))), [rule])[0]!
  return compareFields(
    parsed.fields,
    parseIdentificationFields(type, left),
    parseIdentificationFields(type, right),
  )
}

/**
 * Compare one same-work, same-kind part rule. Supply volumeNumberLabels only after its volume was uniquely
 * corresponded on both sides; absence leaves that rule unavailable rather than falling back to a work number.
 */
export function comparePartIdentification<T extends PartType>(
  type: T,
  rule: MatchingRule<PartMatchingField<T>>,
  left: PartIdentificationFields<T>,
  right: PartIdentificationFields<T>,
  volumeNumberLabels?: { readonly left: string; readonly right: string },
): MatchingComparison {
  const parsed = parseValue(rules(getPartMatchingFields(type)), [rule])[0]!
  return compareFields(
    parsed.fields,
    {
      ...parsePartIdentificationFields(type, left),
      ...(volumeNumberLabels ? { volumeNumberLabel: volumeNumberLabels.left } : {}),
    },
    {
      ...parsePartIdentificationFields(type, right),
      ...(volumeNumberLabels ? { volumeNumberLabel: volumeNumberLabels.right } : {}),
    },
  )
}
