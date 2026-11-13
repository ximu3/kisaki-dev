/** @fileoverview Implements fixed Unicode 18 NFKC and default full case folding independently of host ICU. */

import data from './unicode.generated.json' with { type: 'json' }

/** Fixed canonical and compatibility decompositions used before canonical ordering. */
const decomposition: Readonly<Record<number, readonly number[]>> = data.decomposition

/** Fixed canonical combining classes; absent scalars are starters. */
const combining: Readonly<Record<number, number>> = data.combining

/** Default full case-fold mappings from the pinned Unicode C and F records. */
const folding: Readonly<Record<number, readonly number[]>> = data.folding

/** Allowed canonical pair compositions indexed by a collision-free pair of Unicode scalars. */
const composition = new Map(
  data.composition.map(([first, second, result]) => [first! * 0x110000 + second!, result!]),
)

/** Decomposes Hangul syllables and table-driven compatibility characters to their terminal scalars. */
function decompose(input: readonly number[]): number[] {
  const result: number[] = []
  const pending = [...input].reverse()
  while (pending.length > 0) {
    const point = pending.pop()!
    const syllable = point - 0xac00
    if (syllable >= 0 && syllable < 11172) {
      result.push(0x1100 + Math.floor(syllable / 588), 0x1161 + Math.floor((syllable % 588) / 28))
      if (syllable % 28 !== 0) {
        result.push(0x11a7 + (syllable % 28))
      }
    } else {
      const mapping = decomposition[point]
      if (mapping) {
        for (let index = mapping.length - 1; index >= 0; index -= 1) {
          pending.push(mapping[index]!)
        }
      } else {
        result.push(point)
      }
    }
  }
  return result
}

/** Canonically orders nonstarter runs while preserving equal-class source order. */
function reorder(input: readonly number[]): number[] {
  const result: number[] = []
  let marks: number[] = []
  for (const point of input) {
    if ((combining[point] ?? 0) === 0) {
      marks.sort((left, right) => combining[left]! - combining[right]!)
      for (const mark of marks) {
        result.push(mark)
      }
      marks = []
      result.push(point)
    } else {
      marks.push(point)
    }
  }
  marks.sort((left, right) => combining[left]! - combining[right]!)
  for (const mark of marks) {
    result.push(mark)
  }
  return result
}

/** Returns a permitted Hangul or canonical pair composition. */
function composePair(first: number, second: number): number | undefined {
  if (first >= 0x1100 && first < 0x1113 && second >= 0x1161 && second < 0x1176) {
    return 0xac00 + (first - 0x1100) * 588 + (second - 0x1161) * 28
  }
  if (
    first >= 0xac00 &&
    first < 0xd7a4 &&
    (first - 0xac00) % 28 === 0 &&
    second > 0x11a7 &&
    second < 0x11c3
  ) {
    return first + second - 0x11a7
  }
  return composition.get(first * 0x110000 + second)
}

/** Performs canonical composition with the blocking rule from UAX #15. */
function compose(input: readonly number[]): number[] {
  const result: number[] = []
  let starterIndex = -1
  let previousClass = 0
  for (const point of input) {
    const currentClass = combining[point] ?? 0
    const combined = starterIndex < 0 ? undefined : composePair(result[starterIndex]!, point)
    if (combined !== undefined && (previousClass === 0 || previousClass < currentClass)) {
      result[starterIndex] = combined
    } else {
      if (currentClass === 0) {
        starterIndex = result.length
      }
      result.push(point)
      previousClass = currentClass
    }
  }
  return result
}

/** Normalizes scalar text to Unicode 18 NFKC, retaining unassigned characters unchanged. */
export function normalizeNfkc(input: string): string {
  const points = compose(
    reorder(decompose(Array.from(input, (character) => character.codePointAt(0)!))),
  )
  return points.map((point) => String.fromCodePoint(point)).join('')
}

/** Applies NFKC, default C/F folding, and NFKC again for the desktop name-comparison contract. */
export function normalizeName(input: string): string {
  const folded: string[] = []
  for (const character of normalizeNfkc(input)) {
    const mapping = folding[character.codePointAt(0)!]
    folded.push(mapping ? mapping.map((point) => String.fromCodePoint(point)).join('') : character)
  }
  return normalizeNfkc(folded.join(''))
}
