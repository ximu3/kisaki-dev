/** @fileoverview Defines file-relative video positions and half-open annotation ranges in seconds. */

import * as v from 'valibot'
import { objectSchema } from '../schema'
import { nonnegativeNumberSchema, parseContract } from '../validation'

/** A requested file-relative second position, or an explicit instruction to start at the beginning. */
export type PlaybackPositionInput = number | 'start'
/** A historical point or nonempty half-open interval; actual seeking checks the live media separately. */
export type PlaybackAnnotationLocation =
  | { readonly type: 'position'; readonly positionSeconds: number }
  | { readonly type: 'range'; readonly startSeconds: number; readonly endSeconds: number }

export const playbackAnnotationLocationSchema = v.union([
  objectSchema({ type: v.literal('position'), positionSeconds: nonnegativeNumberSchema }),
  v.pipe(
    objectSchema({
      type: v.literal('range'),
      startSeconds: nonnegativeNumberSchema,
      endSeconds: nonnegativeNumberSchema,
    }),
    v.check((value) => value.startSeconds < value.endSeconds),
  ),
])

/** Validate video seconds without rounding, clamping, or converting an invalid range to a point. */
export function parsePlaybackAnnotationLocation(input: unknown): PlaybackAnnotationLocation {
  return parseContract(playbackAnnotationLocationSchema, input, 'playback annotation location')
}
/** Validate an open/seek value; start is not a persistent location. */
export function parsePlaybackPositionInput(input: unknown): PlaybackPositionInput {
  return parseContract(
    v.union([nonnegativeNumberSchema, v.literal('start')]),
    input,
    'playback position',
  )
}
