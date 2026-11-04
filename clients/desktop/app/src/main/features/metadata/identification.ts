/** @fileoverview Normalizes and combines original identification clues without promoting them to identity. */

import type { EntryType, ExternalIdentity } from '@kisaki3/desktop-contracts/library'
import type { IdentificationClues, WorkClues } from '@kisaki3/desktop-contracts/metadata'
import { parseIdentificationClues } from '@kisaki3/desktop-contracts/metadata'
import { normalizeNfc } from '../../infrastructure/text/names'
import type { PartialDate } from '@kisaki3/desktop-contracts/date'

/** Merge only caller-confirmed clues. First valid single values win as whole values; exact identities retain first-seen order. */
export function mergeIdentificationClues<T extends EntryType>(
  type: T,
  input: readonly IdentificationClues<T>[],
): IdentificationClues<T> {
  const values = input.map((item) => parseIdentificationClues(type, item))
  const result: Record<string, unknown> = {}
  const identities: ExternalIdentity[] = []
  const seen = new Set<string>()
  for (const clues of values) {
    for (const [field, value] of Object.entries(clues)) {
      if (field !== 'externalIdentities' && !Object.hasOwn(result, field)) {
        result[field] = value
      }
    }

    for (const identity of clues.externalIdentities ?? []) {
      const key = identityKey(identity)
      if (!seen.has(key)) {
        seen.add(key)
        identities.push(identity)
      }
    }
  }
  if (identities.length > 0) {
    result.externalIdentities = identities
  }
  return parseIdentificationClues(type, result)
}

/** Return whether supplied source clues add an actually new fact; copying original input is not a recognition result. */
export function hasNewWorkClues(base: WorkClues, result: WorkClues): boolean {
  if (
    result.name !== undefined &&
    (base.name === undefined || metadataNameKey(result.name) !== metadataNameKey(base.name))
  ) {
    return true
  }
  if (
    result.originalName !== undefined &&
    (base.originalName === undefined ||
      metadataNameKey(result.originalName) !== metadataNameKey(base.originalName))
  ) {
    return true
  }

  const dateKey = (date: PartialDate | undefined): string =>
    JSON.stringify([date?.year ?? null, date?.month ?? null, date?.day ?? null])
  if (
    result.releaseDate !== undefined &&
    dateKey(result.releaseDate) !== dateKey(base.releaseDate)
  ) {
    return true
  }

  const known = new Set((base.externalIdentities ?? []).map(identityKey))
  return (result.externalIdentities ?? []).some((identity) => !known.has(identityKey(identity)))
}

function identityKey(identity: ExternalIdentity): string {
  return JSON.stringify([identity.source, identity.sourceId])
}

/** Matching uses canonical composition and English case folding, without compatibility folding or punctuation removal. */
export function metadataNameKey(value: string): string {
  return normalizeNfc(value)
    .trim()
    .replace(/\s+/gu, ' ')
    .replace(/[A-Z]/g, (letter) => letter.toLowerCase())
}
