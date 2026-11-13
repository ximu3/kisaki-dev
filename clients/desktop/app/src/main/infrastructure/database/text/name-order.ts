/** @fileoverview Encodes fixed Unicode natural-name ordering into SQLite-comparable binary keys. */

import data from './unicode.generated.json' with { type: 'json' }
import { normalizeName } from './normalization'

/** Fixed Unicode decimal values indexed by scalar, independent of the host's Unicode tables. */
const digits: Readonly<Record<number, number>> = data.digits

/** Appends an unsigned 32-bit count in lexicographically comparable byte order. */
function appendCount(output: number[], value: number): void {
  output.push((value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255)
}

/** Appends a scalar token; zero is reserved for the end of the primary comparison. */
function appendScalar(output: number[], value: number): void {
  const encoded = value + 1
  output.push(encoded >>> 16, (encoded >>> 8) & 255, encoded & 255)
}

/**
 * Builds a version-one natural-order key without changing saved names.
 *
 * Decimal magnitude precedes all width comparisons. Equal names receive no spelling tiebreaker;
 * callers append their stable identity in SQL. Null remains a separately ordered missing value.
 */
export function nameOrderKey(input: string | null): Buffer | null {
  if (input === null) {
    return null
  }
  const characters = Array.from(normalizeName(input))
  const output: number[] = []
  const widths: number[] = []
  for (let index = 0; index < characters.length;) {
    const point = characters[index]!.codePointAt(0)!
    if (digits[point] === undefined) {
      appendScalar(output, point)
      index += 1
      continue
    }

    const number: number[] = []
    while (index < characters.length) {
      const digit = digits[characters[index]!.codePointAt(0)!]
      if (digit === undefined) {
        break
      }
      number.push(digit)
      index += 1
    }
    widths.push(number.length)
    let first = 0
    while (first < number.length - 1 && number[first] === 0) {
      first += 1
    }
    appendScalar(output, 0x30)
    appendCount(output, number.length - first)
    for (let digit = first; digit < number.length; digit += 1) {
      output.push(number[digit]! + 1)
    }
  }

  output.push(0, 0, 0)
  for (const width of widths) {
    appendCount(output, width)
  }
  return Buffer.from(output)
}

/** Compares non-null names using exactly the same bytes used by database indexes. */
export function compareNames(left: string, right: string): number {
  return Buffer.compare(nameOrderKey(left)!, nameOrderKey(right)!)
}
