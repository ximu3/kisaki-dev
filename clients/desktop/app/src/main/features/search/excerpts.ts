/** @fileoverview Bounds selected plain-text search excerpts at complete grapheme boundaries. */

import { DesktopError } from '@kisaki3/desktop-contracts/errors'
/** Bound an already selected plain-text excerpt to 160 UTF-16 units, ending only at a complete extended grapheme. */
export function truncateSearchExcerpt(input: string): string {
  if (typeof input !== 'string' || /[\uD800-\uDFFF]/u.test(input)) {
    throw new DesktopError('InvalidInput', 'Invalid excerpt text')
  }
  const value = input
  if (value.length <= 160) {
    return value
  }

  let end = 0
  for (const part of new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(value)) {
    if (part.index + part.segment.length > 160) {
      break
    }
    end = part.index + part.segment.length
  }

  return value.slice(0, end)
}
