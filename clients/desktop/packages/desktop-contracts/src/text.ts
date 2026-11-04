/** @fileoverview Compares Unicode scalar identities for canonical relationship and backup encodings. */

import { DesktopError } from './errors'

/** Compare valid scalar strings by UTF-8 byte order, which preserves scalar order and differs from UTF-16 order. */
export function compareIdentityText(left: string, right: string): number {
  if (/[\uD800-\uDFFF]/u.test(left) || /[\uD800-\uDFFF]/u.test(right)) {
    throw new DesktopError('InvalidInput', 'Text must contain valid Unicode scalar values')
  }

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
