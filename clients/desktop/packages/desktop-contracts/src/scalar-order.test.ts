/** @fileoverview Checks the scalar order used by canonical identity encodings. */
import { expect, test } from 'vitest'
import { compareIdentityText } from './scalar-order'

test('orders supplementary code points after BMP scalars and rejects unpaired surrogates', () => {
  expect(compareIdentityText('\uE000', '\u{10000}')).toBe(-1)
  expect(() => compareIdentityText('\ud800', 'a')).toThrow()
})
