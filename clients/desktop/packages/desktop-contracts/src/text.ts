/** @fileoverview Implements pinned Unicode normalization and natural name order without locale-dependent collation. */

import { DesktopError } from './errors'
import {
  canonicalDecompositions,
  caseFolding,
  combiningClasses,
  compositions,
  decimalDigits,
  decompositions,
} from './text/unicode.generated'

/** Name-index data version; consumers rebuild derived keys when this version or the encoding changes. */
export const nameUnicodeVersion = '18.0.0'
export const nameSortKeyVersion = 1

function requireText(value: string): void {
  if (/[\uD800-\uDFFF]/u.test(value)) {
    throw new DesktopError('InvalidInput', 'Text must contain valid Unicode scalar values')
  }
}

function appendDecomposition(point: number, output: number[], compatibility: boolean): void {
  // Hangul syllables have algorithmic decompositions, absent from UnicodeData's mapping column.
  const syllable = point - 0xac00
  if (syllable >= 0 && syllable < 11_172) {
    output.push(0x1100 + Math.floor(syllable / 588), 0x1161 + Math.floor((syllable % 588) / 28))
    if (syllable % 28 !== 0) {
      output.push(0x11a7 + (syllable % 28))
    }
    return
  }
  const mapping = compatibility ? decompositions[point] : canonicalDecompositions[point]
  if (mapping) {
    for (const child of mapping) {
      appendDecomposition(child, output, compatibility)
    }
  } else {
    output.push(point)
  }
}

function compose(starter: number, point: number): number | undefined {
  const leading = starter - 0x1100
  const vowel = point - 0x1161
  if (leading >= 0 && leading < 19 && vowel >= 0 && vowel < 21) {
    return 0xac00 + (leading * 21 + vowel) * 28
  }
  const syllable = starter - 0xac00
  const trailing = point - 0x11a7
  if (syllable >= 0 && syllable < 11_172 && syllable % 28 === 0 && trailing > 0 && trailing < 28) {
    return starter + trailing
  }
  return compositions[`${starter},${point}`]
}

/** Normalize with the retained Unicode 18 data, including characters absent from the host's ICU version. */
export function normalizeNfkc(value: string): string {
  return normalize(value, true)
}

/** Canonical normalization preserves compatibility distinctions used by identity matching rather than natural sorting. */
export function normalizeNfc(value: string): string {
  return normalize(value, false)
}

function normalize(value: string, compatibility: boolean): string {
  requireText(value)
  const decomposed: number[] = []
  for (const character of value) {
    appendDecomposition(character.codePointAt(0)!, decomposed, compatibility)
  }

  // Stable ordering applies only inside non-starter runs, including a leading run without a starter.
  const ordered: number[] = []
  let marks: number[] = []
  function flushMarks(): void {
    marks.sort((a, b) => (combiningClasses[a] ?? 0) - (combiningClasses[b] ?? 0))
    for (const point of marks) {
      ordered.push(point)
    }
    marks = []
  }
  for (const point of decomposed) {
    if ((combiningClasses[point] ?? 0) === 0) {
      flushMarks()
      ordered.push(point)
    } else {
      marks.push(point)
    }
  }
  flushMarks()

  const result: number[] = []
  let starterIndex = -1
  let lastClass = 0
  for (const point of ordered) {
    const currentClass = combiningClasses[point] ?? 0
    const composite = starterIndex < 0 ? undefined : compose(result[starterIndex]!, point)
    if (composite !== undefined && (lastClass < currentClass || lastClass === 0)) {
      result[starterIndex] = composite
      continue
    }
    if (currentClass === 0) {
      starterIndex = result.length
    }
    result.push(point)
    lastClass = currentClass
  }
  return result.map((point) => String.fromCodePoint(point)).join('')
}

/** NFKC, default full C/F case folding, then NFKC. Original display text is never rewritten. */
export function normalizeNameForSort(value: string): string {
  const folded: string[] = []
  for (const character of normalizeNfkc(value)) {
    const mapping = caseFolding[character.codePointAt(0)!]
    folded.push(mapping ? mapping.map((point) => String.fromCodePoint(point)).join('') : character)
  }
  return normalizeNfkc(folded.join(''))
}

/** Normalize only tag matching: compatibility form, trimmed/collapsed whitespace and locale-free lower case. */
export function createTagNameKey(name: string): string {
  const key = normalizeNfkc(name).trim().replace(/\s+/gu, ' ').toLowerCase()
  if (!key) {
    throw new DesktopError('InvalidInput', 'A tag name must not be empty')
  }
  return key
}

/** Ordinary search terms do not become regexes and never rewrite source identities or stored content. */
export function normalizeSearchTerms(search: string): readonly string[] {
  const normalized = normalizeNameForSort(search).trim()
  return normalized ? normalized.split(/\s+/u) : []
}

function appendSize(output: number[], value: number): void {
  const bytes = new Array<number>(8).fill(0)
  let remaining = BigInt(value)
  for (let index = bytes.length - 1; index >= 0; index -= 1) {
    bytes[index] = Number(remaining & 255n)
    remaining >>= 8n
  }
  output.push(...bytes)
}

/**
 * Produce a byte-lexicographic name key: arbitrary-length Nd runs compare by value, then all run widths.
 * The key excludes identity; consumers append their declared stable identity in ascending order even for desc.
 */
export function createNameSortKey(name: string): Uint8Array {
  const characters = Array.from(normalizeNameForSort(name))
  const output: number[] = []
  const widths: number[] = []
  for (let index = 0; index < characters.length;) {
    const point = characters[index]!.codePointAt(0)!
    const digit = decimalDigits[point]
    const position = (digit === undefined ? point : 0x30) + 1
    output.push(position >>> 16, (position >>> 8) & 255, position & 255)
    if (digit === undefined) {
      index += 1
      continue
    }
    const run: number[] = []
    while (index < characters.length) {
      const next = decimalDigits[characters[index]!.codePointAt(0)!]
      if (next === undefined) {
        break
      }
      run.push(next)
      index += 1
    }
    widths.push(run.length)
    let first = 0
    while (first < run.length - 1 && run[first] === 0) {
      first += 1
    }
    appendSize(output, run.length - first)
    for (let offset = first; offset < run.length; offset += 1) {
      output.push(run[offset]! + 1)
    }
  }
  output.push(0, 0, 0)
  for (const width of widths) {
    appendSize(output, width)
  }
  return Uint8Array.from(output)
}

/** Compare derived binary keys in the same order used by database blob indexes. */
export function compareNameSortKeys(left: Uint8Array, right: Uint8Array): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] !== right[index]) {
      return left[index]! < right[index]! ? -1 : 1
    }
  }
  if (left.length === right.length) {
    return 0
  }
  return left.length < right.length ? -1 : 1
}

/** Compare full names with fixed Unicode natural order; equal normalized names require the owner's ID tie-break. */
export function compareNaturalNames(left: string, right: string): number {
  return compareNameSortKeys(createNameSortKey(left), createNameSortKey(right))
}

/** Compare valid scalar strings by UTF-8 byte order, which preserves scalar order and differs from UTF-16 order. */
export function compareIdentityText(left: string, right: string): number {
  requireText(left)
  requireText(right)
  const a = Array.from(left)
  const b = Array.from(right)
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    const first = a[index]!.codePointAt(0)!
    const second = b[index]!.codePointAt(0)!
    if (first !== second) {
      return first < second ? -1 : 1
    }
  }
  if (a.length === b.length) {
    return 0
  }
  return a.length < b.length ? -1 : 1
}
