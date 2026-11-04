/** @fileoverview Defines normalized source-page geometry independently of any renderer or media engine. */

import * as v from 'valibot'
import { parseValue } from './validation'

/** A point in the complete source page, with top-left origin and downward positive y. */
export interface NormalizedPoint {
  readonly x: number
  readonly y: number
}

/** A nonempty rectangle wholly inside the source page; display rotation and zoom are not stored here. */
export interface NormalizedRect extends NormalizedPoint {
  readonly width: number
  readonly height: number
}

/** Clockwise convex vertices, beginning at the topmost then leftmost vertex; not text reading order. */
export type NormalizedQuad = readonly [
  NormalizedPoint,
  NormalizedPoint,
  NormalizedPoint,
  NormalizedPoint,
]

const unit = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1))

const extent = v.pipe(unit, v.gtValue(0))

const pointSchema = v.strictObject({ x: unit, y: unit })

const rectSchema = v.pipe(
  v.strictObject({ x: unit, y: unit, width: extent, height: extent }),
  v.check((rect) => rect.x + rect.width <= 1 && rect.y + rect.height <= 1),
)

const quadSchema = v.pipe(
  v.strictTuple([pointSchema, pointSchema, pointSchema, pointSchema]),
  v.check((points) => {
    const first = points[0]
    if (points.some((point) => point.y < first.y || (point.y === first.y && point.x < first.x))) {
      return false
    }

    return points.every((a, index) => {
      const b = points[(index + 1) % 4]!
      const c = points[(index + 2) % 4]!
      return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) > 0
    })
  }),
)

/** Reject nonfinite or out-of-page coordinates; callers resolve display rounding before submission. */
export function parseNormalizedPoint(input: unknown): NormalizedPoint {
  return parseValue(pointSchema, input, 'Invalid normalized point')
}

/** Require positive extents and a wholly contained rectangle without clamping. */
export function parseNormalizedRect(input: unknown): NormalizedRect {
  return parseValue(rectSchema, input, 'Invalid normalized rectangle')
}

/** Require the canonical start vertex and clockwise, nondegenerate convex shape; preserve fragment order. */
export function parseNormalizedQuad(input: unknown): NormalizedQuad {
  return parseValue(quadSchema, input, 'Invalid normalized quadrilateral')
}
