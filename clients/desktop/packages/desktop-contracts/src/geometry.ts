/** @fileoverview Defines normalized source geometry and integer pixel crops without display scaling. */

import * as v from 'valibot'
import { objectSchema } from './schema'
import { nonnegativeIntegerSchema, parseContract } from './validation'

/** A point in an unrotated source page, normalized to its width and height. */
export interface NormalizedPoint {
  readonly x: number
  readonly y: number
}
/** A positive source region wholly contained within the unit page. */
export interface NormalizedRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}
/** A convex clockwise source quadrilateral, beginning with minimum y and then minimum x. */
export type NormalizedQuad = readonly [
  NormalizedPoint,
  NormalizedPoint,
  NormalizedPoint,
  NormalizedPoint,
]
/** A crop after orientation, flips, and rotation; units are actual pixels, not CSS pixels. */
export interface PixelCrop {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

const fraction = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1))
const positiveFraction = v.pipe(
  fraction,
  v.check((value) => value > 0),
)
export const normalizedPointSchema = objectSchema({ x: fraction, y: fraction })
export const normalizedRectSchema = v.pipe(
  objectSchema({ x: fraction, y: fraction, width: positiveFraction, height: positiveFraction }),
  v.check((value) => value.x + value.width <= 1 && value.y + value.height <= 1),
)
export const pixelCropSchema = objectSchema({
  left: nonnegativeIntegerSchema,
  top: nonnegativeIntegerSchema,
  width: v.pipe(nonnegativeIntegerSchema, v.minValue(1)),
  height: v.pipe(nonnegativeIntegerSchema, v.minValue(1)),
})
export const normalizedQuadSchema = v.pipe(
  v.strictTuple([
    normalizedPointSchema,
    normalizedPointSchema,
    normalizedPointSchema,
    normalizedPointSchema,
  ]),
  v.check((points) => {
    const first = points[0]
    if (points.some((point) => point.y < first.y || (point.y === first.y && point.x < first.x))) {
      return false
    }
    for (let index = 0; index < 4; index++) {
      const a = points[index]!
      const b = points[(index + 1) % 4]!
      const c = points[(index + 2) % 4]!
      if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) <= 0) {
        return false
      }
    }
    return true
  }),
  v.readonly(),
)

/** Validate normalized source geometry; do not clamp an invalid region into another selection. */
export function parseNormalizedRect(value: unknown): NormalizedRect {
  return parseContract(normalizedRectSchema, value, 'normalized rectangle')
}
/** Validate a normalized source point, preserving valid zero coordinates. */
export function parseNormalizedPoint(value: unknown): NormalizedPoint {
  return parseContract(normalizedPointSchema, value, 'normalized point')
}
/** Validate winding, convexity, canonical start, and unit bounds without repairing geometry. */
export function parseNormalizedQuad(value: unknown): NormalizedQuad {
  return parseContract(normalizedQuadSchema, value, 'normalized quadrilateral')
}
/** Validate pixel crop values; actual bounds are checked against the transformed image by its owner. */
export function parsePixelCrop(value: unknown): PixelCrop {
  return parseContract(pixelCropSchema, value, 'pixel crop')
}
