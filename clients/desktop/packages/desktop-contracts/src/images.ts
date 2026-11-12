/** @fileoverview Defines verified image preparation and deterministic transforms on retained source content. */

import type { PreparedAttachment, FileInput, ReadResourceRef } from './resources'
import type { CallOptions } from './operations'
import { parseValue, nonnegativeInteger, positiveInteger } from './validation'
import * as v from 'valibot'

/** Formats of verified prepared bytes; SVG and ICO are converted to PNG before this result is exposed. */
export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'gif'

/** An independently held image preparation with decoded dimensions, format and frame count. */
export interface PreparedImage extends PreparedAttachment {
  /** Width in pixels after source orientation. */
  readonly width: number
  /** Height in pixels after source orientation. */
  readonly height: number
  readonly format: ImageFormat
  /** Actual readable frame count; static images have one frame. */
  readonly frameCount: number
}

/**
 * A frame selection and ordered image transforms.
 *
 * Processing corrects source orientation, applies flips, rotates clockwise and then crops. Crop
 * coordinates use pixels after the preceding steps.
 */
export interface ImageTransform {
  /** Zero-based frame index, required for animation; static images accept zero or omission. */
  readonly frameIndex?: number
  /** Whether to flip horizontally before rotation; defaults to false. */
  readonly flipHorizontal?: boolean
  /** Whether to flip vertically before rotation; defaults to false. */
  readonly flipVertical?: boolean
  /** Clockwise rotation in finite degrees within [0, 360); defaults to zero. */
  readonly rotationDegrees?: number
  /** Integer pixel bounds with positive extents, wholly inside the transformed image. */
  readonly crop?: {
    readonly left: number
    readonly top: number
    readonly width: number
    readonly height: number
  }
}

/**
 * Image preparation and transformation with independent result holds.
 *
 * The caller releases each result. Failed work preserves the existing image.
 */
export interface ImagesApi {
  /**
   * Reads and verifies image bytes, converting supported vector or icon inputs to PNG.
   *
   * Returns an independent hold before any business reference is committed.
   */
  prepare(input: FileInput, call?: CallOptions): Promise<PreparedImage>

  /**
   * Transforms held source content into a new static PNG preparation.
   *
   * Animated inputs require an explicit frameIndex. The host verifies frame availability and final
   * crop bounds.
   */
  transform(
    resource: ReadResourceRef,
    input: ImageTransform,
    call?: CallOptions,
  ): Promise<PreparedImage>
}

/**
 * Parses transform values without decoding image content.
 *
 * The executor separately checks image-dependent frame and crop bounds.
 */
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
