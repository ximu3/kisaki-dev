/** @fileoverview Selects metadata field answers while retaining unanswered and explicit-empty distinctions. */

import type {
  MetadataFieldValue,
  MetadataFieldRef,
  ImageCandidate,
} from '@kisaki3/desktop-contracts/metadata'
import { parseMetadataFieldValue } from '@kisaki3/desktop-contracts/metadata'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { metadataNameKey } from '../identification'

/** Select by declared provider order. Undefined means unanswered; false, zero and partial dates are not empty. */
export function selectMetadataValue<T>(
  answers: readonly (T | undefined)[],
  selection: 'first' | 'firstNonEmpty',
  isEmpty: (value: T) => boolean,
): T | undefined {
  let first: T | undefined
  for (const value of answers) {
    if (value === undefined) {
      continue
    }
    if (first === undefined) {
      first = value
    }
    if (selection === 'first' || !isEmpty(value)) {
      return value
    }
  }

  return first
}

/** Union complete members by their domain's exact key, preserving provider order and the whole first member. */
export function unionMetadataMembers<T>(
  answers: readonly (readonly T[] | undefined)[],
  key: (value: T) => string,
): readonly T[] | undefined {
  const result: T[] = []
  const seen = new Set<string>()
  let answered = false
  for (const answer of answers) {
    if (answer === undefined) {
      continue
    }
    answered = true
    for (const item of answer) {
      const identity = key(item)
      if (!seen.has(identity)) {
        seen.add(identity)
        result.push(item)
      }
    }
  }

  return answered ? result : undefined
}

/** Legal empty answers are null, blank text or empty collections; false, zero and partial calendar facts are nonempty. */
export function isEmptyMetadataValue(value: MetadataFieldValue<MetadataFieldRef>): boolean {
  return (
    value === null ||
    (typeof value === 'string' && value.trim().length === 0) ||
    (Array.isArray(value) && value.length === 0)
  )
}

/** Only declared collection fields support union; no scalar is converted into a list to accept that selection. */
export function isMetadataCollectionField(field: MetadataFieldRef): boolean {
  return (
    (field.object === 'entry' || field.object === 'part') &&
    [
      'aliases',
      'externalLinks',
      'originalLanguages',
      'primaryImage',
      'backdropImage',
      'titleLogo',
      'iconImage',
    ].includes(field.field)
  )
}

/** Select and validate one field with its actual equality rules, preserving the first complete duplicate member. */
export function selectMetadataFieldValue<F extends MetadataFieldRef>(
  field: F,
  answers: readonly (MetadataFieldValue<F> | undefined)[],
  selection: MetadataFieldValue<F> extends readonly unknown[]
    ? 'first' | 'firstNonEmpty' | 'union'
    : 'first' | 'firstNonEmpty',
): MetadataFieldValue<F> | undefined {
  const values = answers.map((value) =>
    value === undefined ? undefined : parseMetadataFieldValue(field, value),
  )
  if (selection !== 'union') {
    return selectMetadataValue<MetadataFieldValue<F>>(values, selection, isEmptyMetadataValue)
  }
  if (!isMetadataCollectionField(field)) {
    throw new DesktopError('InvalidInput', 'Scalar metadata fields do not support union')
  }

  let ordinal = 0
  const arrays: (readonly unknown[] | undefined)[] = values.map((value) => {
    if (value === undefined) {
      return undefined
    }
    if (!Array.isArray(value)) {
      throw new DesktopError('InvalidInput', 'Metadata union requires complete collection answers')
    }

    return value
  })

  const result = unionMetadataMembers(arrays, (member) => {
    if (field.field === 'aliases') {
      return metadataNameKey(member as string)
    }
    if (field.field === 'originalLanguages') {
      return member as string
    }
    if (field.field === 'externalLinks') {
      return (member as { url: string }).url
    }

    const image = member as ImageCandidate
    if (image.identity) {
      return JSON.stringify(['source', image.identity.source, image.identity.id])
    }
    if (image.image.type === 'url' && Object.keys(image.image.headers ?? {}).length === 0) {
      return JSON.stringify(['url', image.image.url, image.image.redirect ?? 'follow'])
    }
    if (image.image.type === 'resource') {
      return JSON.stringify(['resource', image.image.resource.id])
    }

    // Without reliable resource identity, retaining two candidates is preferable to erasing one by guessed equality.
    return JSON.stringify(['unidentified', ordinal++])
  })

  return result === undefined ? undefined : parseMetadataFieldValue(field, result)
}
