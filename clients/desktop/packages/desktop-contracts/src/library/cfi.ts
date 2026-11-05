/** @fileoverview Checks EPUB CFI point syntax without interpreting a document tree or changing source addresses. */

import { DesktopError } from '../errors'

/** CFI adopts XML's Char production, including tab, LF and CR; other discouraged scalars remain legal. */
function isXmlCharacter(codePoint: number): boolean {
  return (
    codePoint === 0x9 ||
    codePoint === 0xa ||
    codePoint === 0xd ||
    (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
    (codePoint >= 0x10000 && codePoint <= 0x10ffff)
  )
}

/** Validate the point subset of EPUB CFI 1.1; ranges are represented by two complete ReadingAnchor values. */
export function parseCfiPoint(value: string): string {
  let offset = 8

  function invalid(): never {
    throw new DesktopError('InvalidInput', 'Invalid EPUB CFI point')
  }

  if (!value.startsWith('epubcfi(') || !value.endsWith(')')) {
    invalid()
  }
  const end = value.length - 1

  function numberToken(integer: boolean): string {
    const start = offset
    while (offset < end && /[0-9]/.test(value[offset]!)) {
      offset += 1
    }
    if (offset === start || (value[start] === '0' && offset > start + 1)) {
      invalid()
    }

    if (!integer && value[offset] === '.') {
      offset += 1
      const decimals = offset
      while (offset < end && /[0-9]/.test(value[offset]!)) {
        offset += 1
      }
      if (offset === decimals || value[offset - 1] === '0') {
        invalid()
      }
    }

    return value.slice(start, offset)
  }

  function spatialCoordinate(): void {
    const token = numberToken(false)
    const integerPart = token.split('.')[0]!

    // Canonical nonnegative decimals with three or more integer digits can only fit as exactly 100.
    if (integerPart.length >= 3 && token !== '100') {
      invalid()
    }
  }

  function assertionValue(noSpace = false): void {
    const start = offset
    while (offset < end && !',;]='.includes(value[offset]!)) {
      const codePoint = value.codePointAt(offset)!
      const character = value[offset]!
      if (character === '^') {
        offset += 1
        if (!value[offset] || !'^[](),;='.includes(value[offset]!)) {
          invalid()
        }
      } else if (
        '[()'.includes(character) ||
        !isXmlCharacter(codePoint) ||
        (noSpace && character === ' ')
      ) {
        invalid()
      }
      offset += codePoint > 0xffff ? 2 : 1
    }

    if (offset === start) {
      invalid()
    }
  }

  function assertion(): void {
    if (value[offset] !== '[') {
      return
    }

    offset += 1
    if (value[offset] !== ';') {
      if (value[offset] !== ',') {
        assertionValue()
      }
      if (value[offset] === ',') {
        offset += 1
        assertionValue()
      }
    }

    while (value[offset] === ';') {
      offset += 1
      assertionValue(true)
      if (value[offset] !== '=') {
        invalid()
      }
      offset += 1
      assertionValue()
      while (value[offset] === ',') {
        offset += 1
        assertionValue()
      }
    }

    if (value[offset] !== ']') {
      invalid()
    }
    offset += 1
  }

  function locationOffset(): void {
    if (value[offset] === ':') {
      offset += 1
      numberToken(true)
    } else {
      if (value[offset] === '~') {
        offset += 1
        numberToken(false)
      }
      if (value[offset] === '@') {
        offset += 1
        spatialCoordinate()
        if (value[offset] !== ':') {
          invalid()
        }
        offset += 1
        spatialCoordinate()
      }
    }

    assertion()
  }

  let requireStep = true
  while (offset < end) {
    if (value[offset] === '/') {
      offset += 1
      numberToken(true)
      assertion()
      requireStep = false
    } else if (!requireStep && value[offset] === '!') {
      offset += 1
      if (value[offset] === '/') {
        requireStep = true
        continue
      }
      if (!':~@'.includes(value[offset] ?? '')) {
        invalid()
      }
      locationOffset()
      break
    } else if (!requireStep && ':~@'.includes(value[offset]!)) {
      locationOffset()
      break
    } else {
      invalid()
    }
  }

  if (requireStep || offset !== end) {
    invalid()
  }

  return value
}
