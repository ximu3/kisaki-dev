/** @fileoverview Defines verified image preparation and deterministic transforms on retained source content. */

import type { PreparedAttachment, FileInput, ReadResourceRef } from './resources'
import type { CallOptions } from './operations'
import { parseValue, nonnegativeInteger, positiveInteger } from './validation'
import * as v from 'valibot'

/** Formats of verified prepared bytes; SVG and ICO are converted to PNG before this result is exposed. */
export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'gif'

/** Dimensions reflect source orientation; frameCount is the actual readable count, one for static images. */
export interface PreparedImage extends PreparedAttachment {
  readonly width: number
  readonly height: number
  readonly format: ImageFormat
  readonly frameCount: number
}

/** Crop coordinates address pixels after orientation, flips and clockwise rotation, in that order. */
export interface ImageTransform {
  readonly frameIndex?: number
  readonly flipHorizontal?: boolean
  readonly flipVertical?: boolean
  readonly rotationDegrees?: number
  readonly crop?: {
    readonly left: number
    readonly top: number
    readonly width: number
    readonly height: number
  }
}

/** Preparation and transformation return independently held results; rejected work preserves the old image. */
export interface ImagesApi {
  prepare(input: FileInput, call?: CallOptions): Promise<PreparedImage>

  /** Animated inputs require an explicit frameIndex; the host verifies frame and final crop bounds. */
  transform(
    resource: ReadResourceRef,
    input: ImageTransform,
    call?: CallOptions,
  ): Promise<PreparedImage>
}

/** Check transform values without decoding; image-dependent frame and crop limits are checked by the executor. */
export function parseImageTransform(input: unknown): ImageTransform {
  return parseValue(
    v.strictObject({
      frameIndex: v.exactOptional(nonnegativeInteger),
      flipHorizontal: v.exactOptional(v.boolean()),
      flipVertical: v.exactOptional(v.boolean()),
      rotationDegrees: v.exactOptional(
        v.pipe(v.number(), v.finite(), v.minValue(0), v.ltValue(360)),
      ),
      crop: v.exactOptional(
        v.strictObject({
          left: nonnegativeInteger,
          top: nonnegativeInteger,
          width: positiveInteger,
          height: positiveInteger,
        }),
      ),
    }),
    input,
    'Invalid image transform',
  )
}
