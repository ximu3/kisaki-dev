/** @fileoverview Compares original identification evidence using an explicitly selected matching rule. */

import {
  parseEntryMatchingRule,
  parsePartMatchingRule,
  parseIdentificationFields,
  parsePartIdentificationFields,
} from '@kisaki3/desktop-contracts/metadata'
import { metadataNameKey } from '../metadata/identification'
import { fileNumberKey } from '@kisaki3/desktop-contracts/library'
import type { EntryType, PartType } from '@kisaki3/desktop-contracts/library'
import type {
  MatchingRule,
  EntryMatchingField,
  IdentificationFields,
  PartMatchingField,
  PartIdentificationFields,
} from '@kisaki3/desktop-contracts/metadata'

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
  const parsed = parseEntryMatchingRule(type, rule)
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
  const parsed = parsePartMatchingRule(type, rule)
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
