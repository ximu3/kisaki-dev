/** @fileoverview Defines file inputs, prepared attachments, and view-scoped resource ownership. */

import * as v from 'valibot'
import { objectSchema, recordSchema } from './schema'
import type { AsyncDisposable } from './execution'
import { absolutePathSchema } from './paths'
import { nonemptyStringSchema, parseContract } from './validation'

/** A host-issued reference to already acquired content; the ID itself grants no access. */
export interface ReadResourceRef {
  readonly id: string
}

/** Ephemeral input, never a stored attachment identity. Credentials require redirect: error. */
export type FileInput =
  | { readonly type: 'path'; readonly path: string }
  | {
      readonly type: 'url'
      readonly url: string
      readonly headers?: Readonly<Record<string, string>>
      readonly redirect?: 'follow' | 'error'
    }
  | { readonly type: 'bytes'; readonly bytes: Uint8Array }
  | { readonly type: 'resource'; readonly resource: ReadResourceRef }

/** Validated content retained for adoption. Disposal does not remove already adopted references. */
export interface PreparedAttachment extends AsyncDisposable {
  readonly attachmentId: string
  readonly resource: ReadResourceRef
}

/** One view's independent occupancy of acquired resources; its URLs expire when disposed. */
export interface ViewResourceBinding extends AsyncDisposable {
  readonly urls: Readonly<Record<string, string>>
}

export const readResourceSchema = objectSchema({ id: nonemptyStringSchema })
export const fileInputSchema = v.union([
  objectSchema({
    type: v.literal('path'),
    path: absolutePathSchema,
  }),
  v.pipe(
    objectSchema({
      type: v.literal('url'),
      url: v.pipe(v.string(), v.check(isHttpUrl)),
      headers: v.exactOptional(
        recordSchema(
          v.pipe(v.string(), v.regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/)),
          v.pipe(
            v.string(),
            v.check((value) => !value.includes('\r') && !value.includes('\n')),
          ),
        ),
      ),
      redirect: v.exactOptional(v.picklist(['follow', 'error'])),
    }),
    v.check(
      (value) =>
        value.redirect === 'error' ||
        !Object.entries(value.headers ?? {}).some(
          ([name, content]) => /^(authorization|cookie)$/i.test(name) && content.trim().length > 0,
        ),
    ),
  ),
  objectSchema({ type: v.literal('bytes'), bytes: v.instance(Uint8Array) }),
  objectSchema({ type: v.literal('resource'), resource: readResourceSchema }),
])

/** Check public input shape and redirect policy; the host still validates actual path/resource ownership. */
export function parseFileInput(input: unknown): FileInput {
  return parseContract(fileInputSchema, input, 'file input')
}

/** Check a resource value's shape; only the real resource owner can establish its validity. */
export function parseReadResourceRef(input: unknown): ReadResourceRef {
  return parseContract(readResourceSchema, input, 'resource reference')
}

/** Shape check for a live prepared handle after endpoint mapping; provenance remains host-owned. */
export const preparedAttachmentSchema = v.custom<PreparedAttachment>((value) => {
  return (
    value !== null &&
    typeof value === 'object' &&
    'attachmentId' in value &&
    v.is(nonemptyStringSchema, value.attachmentId) &&
    'resource' in value &&
    v.is(readResourceSchema, value.resource) &&
    'dispose' in value &&
    typeof value.dispose === 'function'
  )
})

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
