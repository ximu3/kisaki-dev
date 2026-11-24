import * as v from 'valibot'
import { parseValue } from './validation'

export interface NormalizedPoint {
  readonly x: number
  readonly y: number
}

export interface NormalizedRect extends NormalizedPoint {
  readonly width: number
  readonly height: number
}

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

export function parseNormalizedPoint(input: unknown): NormalizedPoint {
  return parseValue(pointSchema, input, 'Invalid normalized point')
}

export function parseNormalizedRect(input: unknown): NormalizedRect {
  return parseValue(rectSchema, input, 'Invalid normalized rectangle')
}

export function parseNormalizedQuad(input: unknown): NormalizedQuad {
  return parseValue(quadSchema, input, 'Invalid normalized quadrilateral')
}
