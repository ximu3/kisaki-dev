import type { PreparedAttachment, FileInput, ReadResourceRef } from './resources'
import type { CallOptions } from './operations'
import { parseValue, nonnegativeInteger, positiveInteger } from './validation'
import * as v from 'valibot'

export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'gif'

export interface PreparedImage extends PreparedAttachment {
  readonly width: number
  readonly height: number
  readonly format: ImageFormat
  readonly frameCount: number
}

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

export interface ImagesApi {
  prepare(input: FileInput, call?: CallOptions): Promise<PreparedImage>

  transform(
    resource: ReadResourceRef,
    input: ImageTransform,
    call?: CallOptions,
  ): Promise<PreparedImage>
}

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
