/** @fileoverview Checks EPUB CFI point syntax without interpreting a document tree or changing source addresses. */

import { DesktopError } from '../errors'

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

  function number(integer: boolean): number {
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

    const result = Number(value.slice(start, offset))
    if (!Number.isFinite(result) || (integer && !Number.isSafeInteger(result))) {
      invalid()
    }

    return result
  }

  function assertionValue(noSpace = false): void {
    const start = offset
    while (offset < end && !',;]='.includes(value[offset]!)) {
      const character = value[offset]!
      if (character === '^') {
        offset += 1
        if (!value[offset] || !'^[](),;='.includes(value[offset]!)) {
          invalid()
        }
      } else if (
        '[()'.includes(character) ||
        character.charCodeAt(0) < 32 ||
        (noSpace && character === ' ')
      ) {
        invalid()
      }
      offset += 1
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
      number(true)
    } else {
      if (value[offset] === '~') {
        offset += 1
        number(false)
      }
      if (value[offset] === '@') {
        offset += 1
        if (number(false) > 100 || value[offset] !== ':') {
          invalid()
        }
        offset += 1
        if (number(false) > 100) {
          invalid()
        }
      }
    }

    assertion()
  }

  let requireStep = true
  while (offset < end) {
    if (value[offset] === '/') {
      offset += 1
      number(true)
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
