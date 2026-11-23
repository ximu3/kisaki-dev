import { DesktopError } from './errors'

/**
 * Compares valid Unicode scalar strings in scalar order, returning -1, 0 or 1.
 *
 * This matches UTF-8 byte order and differs from UTF-16 code-unit order. Unpaired surrogates are
 * rejected.
 */
export function compareIdentityText(left: string, right: string): number {
  if (/[\uD800-\uDFFF]/u.test(left) || /[\uD800-\uDFFF]/u.test(right)) {
    throw new DesktopError('InvalidInput', 'Text must contain valid Unicode scalar values')
  }

  const rightCharacters = right[Symbol.iterator]()
  for (const character of left) {
    const next = rightCharacters.next()
    if (next.done) {
      return 1
    }

    const leftCode = character.codePointAt(0)!
    const rightCode = next.value.codePointAt(0)!
    if (leftCode !== rightCode) {
      return leftCode < rightCode ? -1 : 1
    }
  }
  return rightCharacters.next().done ? 0 : -1
}
