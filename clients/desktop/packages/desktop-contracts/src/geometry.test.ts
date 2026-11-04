/** @fileoverview Verifies normalized rectangles and quads reject degeneracy and out-of-bounds coordinates. */

import { test, expect } from 'vitest'

import { parseNormalizedQuad, parseNormalizedRect } from './geometry'
import { DesktopError } from './errors'

test('normalized geometry rejects degenerate and out-of-bounds values without clamping', () => {
  const quad = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ]

  expect(parseNormalizedQuad(quad)).toEqual(quad)

  expect(() => parseNormalizedQuad([...quad].reverse())).toThrow(DesktopError)

  expect(() => parseNormalizedRect({ x: 0.9, y: 0, width: 0.2, height: 1 })).toThrow(DesktopError)
})
