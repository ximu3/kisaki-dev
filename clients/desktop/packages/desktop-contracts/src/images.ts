/** @fileoverview Defines image preparation, transforms, and immutable prepared-image facts. */

import * as v from 'valibot'
import { objectSchema } from './schema'
import type { CallOptions } from './execution'
import { pixelCropSchema, type PixelCrop } from './geometry'
import {
  fileInputSchema,
  type FileInput,
  type PreparedAttachment,
  type ReadResourceRef,
} from './resources'
import { nonnegativeIntegerSchema, parseContract } from './validation'

/** Original image and optional image-only preview. Declared dimensions are hints, never decoded facts. */
export interface ImageCandidate {
  readonly image: FileInput
  readonly thumbnail?: FileInput
  readonly width?: number
  readonly height?: number
}

export const imageCandidateSchema = objectSchema({
  image: fileInputSchema,
  thumbnail: v.exactOptional(fileInputSchema),
  width: v.exactOptional(v.pipe(nonnegativeIntegerSchema, v.minValue(1))),
  height: v.exactOptional(v.pipe(nonnegativeIntegerSchema, v.minValue(1))),
})

/** Validate candidate input and dimensions; actual image support is established by preparation. */
export function parseImageCandidate(input: unknown): ImageCandidate {
  return parseContract(imageCandidateSchema, input, 'image candidate')
}

/** Actual decoded image facts, after orientation correction and any required format conversion. */
export interface PreparedImage extends PreparedAttachment {
  readonly width: number
  readonly height: number
  readonly format: 'jpeg' | 'png' | 'webp' | 'avif' | 'gif'
  readonly frameCount: number
}

/** Applied in order: frame/orientation, flips, clockwise rotation, then integer-pixel crop. */
export interface ImageTransform {
  readonly frameIndex?: number
  readonly flipHorizontal?: boolean
  readonly flipVertical?: boolean
  readonly rotationDegrees?: number
  readonly crop?: PixelCrop
}

/** Operations retain verified bytes until the caller disposes their returned preparation handles. */
export interface ImagesApi {
  /** Decode and validate actual content. Failure preserves existing image references. */
  prepare(input: FileInput, options?: CallOptions): Promise<PreparedImage>
  /** Produce a new PNG; animated input requires an explicit frame. Never alters the source. */
  transform(
    resource: ReadResourceRef,
    input: ImageTransform,
    options?: CallOptions,
  ): Promise<PreparedImage>
}

/** Parse transform values; the image owner checks frame availability and final crop bounds. */
export function parseImageTransform(input: unknown): ImageTransform {
  return parseContract(
    objectSchema({
      frameIndex: v.exactOptional(nonnegativeIntegerSchema),
      flipHorizontal: v.exactOptional(v.boolean()),
      flipVertical: v.exactOptional(v.boolean()),
      rotationDegrees: v.exactOptional(
        v.pipe(
          v.number(),
          v.finite(),
          v.minValue(0),
          v.check((value) => value < 360),
        ),
      ),
      crop: v.exactOptional(pixelCropSchema),
    }),
    input,
    'image transform',
  )
}
