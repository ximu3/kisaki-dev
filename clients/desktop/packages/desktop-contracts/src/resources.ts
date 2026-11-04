/** @fileoverview Separates transient file inputs, acquired content and view-bound resource addresses. */

import * as v from 'valibot'
import { id, text, nonemptyText, parseDictionary, parseValue } from './validation'
import { parseHttpUrl } from './network'
import { DesktopError } from './errors'

/** An opaque reference to already acquired, fixed content; the actual caller determines its authority. */
export interface ReadResourceRef {
  readonly id: string
}

/** One operation's source, never a persistent attachment identity or a general request configuration. */
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

/**
 * Verified, retained bytes awaiting adoption. The host allocates the future attachment ID.
 * Releasing is idempotent and relinquishes this hold; it never removes adopted references or other holds.
 */
export interface PreparedAttachment {
  readonly attachmentId: string
  readonly resource: ReadResourceRef

  /**
   * Release this preparation hold idempotently after use; adopted references and other holders
   * remain valid.
   */
  dispose(): Promise<void>
}

/** A hold on fixed readable content; closing it stops new reads through this handle after in-flight cleanup. */
export interface ReadResource {
  readonly resource: ReadResourceRef

  /**
   * Stop new reads through this handle and await in-flight cleanup; repeated disposal does not
   * affect other holders.
   */
  dispose(): Promise<void>
}

/** A view owns these transient URLs independently of the original holder and other view bindings. */
export interface ViewResourceBinding {
  readonly urls: Readonly<Record<string, string>>

  /** Revoke this binding's URLs and release only its holds; other view bindings remain valid. */
  dispose(): Promise<void>
}

/** Binds already acquired content to the actual view, preserving input keys and acquiring independent holds. */
export interface ViewResourcesApi {
  /**
   * Acquire independent holds for the actual view and return URLs under the same keys; failure
   * cleans partial bindings without consuming the caller's holds.
   */
  bind(resources: Readonly<Record<string, ReadResourceRef>>): Promise<ViewResourceBinding>
}

const resourceSchema = v.strictObject({ id })

const headerName = v.pipe(text, v.regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/))

const headerValue = v.pipe(
  text,
  v.check((value) => !/[\r\n\0]/.test(value)),
)

const fileInputSchema = v.variant('type', [
  v.strictObject({ type: v.literal('path'), path: nonemptyText }),
  v.strictObject({
    type: v.literal('url'),
    url: v.pipe(v.unknown(), v.transform(parseHttpUrl)),
    headers: v.exactOptional(
      v.pipe(
        v.unknown(),
        v.transform((value) => parseDictionary(headerName, headerValue, value)),
      ),
    ),
    redirect: v.exactOptional(v.picklist(['follow', 'error'])),
  }),
  v.strictObject({ type: v.literal('bytes'), bytes: v.instance(Uint8Array) }),
  v.strictObject({ type: v.literal('resource'), resource: resourceSchema }),
])

/** Validate a resource reference's shape only; existence, ownership and expiry remain host checks. */
export function parseReadResourceRef(input: unknown): ReadResourceRef {
  return parseValue(resourceSchema, input, 'Invalid read resource reference')
}

/** Check a prepared resource's interface while retaining its methods; only the host can verify its authority and hold. */
export function parsePreparedAttachment(input: unknown): PreparedAttachment {
  if (typeof input !== 'object' || input === null) {
    throw new DesktopError('InvalidInput', 'Invalid prepared attachment')
  }

  const value = input as Partial<PreparedAttachment>
  parseValue(id, value.attachmentId)
  parseReadResourceRef(value.resource)
  if (typeof value.dispose !== 'function') {
    throw new DesktopError('InvalidInput', 'Prepared attachment must own a release operation')
  }

  return value as PreparedAttachment
}

/**
 * Validate source shape and HTTP credential redirect policy. No network, file or ownership check occurs.
 * Authorization and Cookie are case-insensitive; any nonempty value requires explicit redirect: error.
 */
export function parseFileInput(input: unknown): FileInput {
  const value = parseValue(fileInputSchema, input, 'Invalid file input')
  if (value.type === 'url') {
    const hasCredentials = Object.entries(value.headers ?? {}).some(
      ([name, header]) =>
        ['authorization', 'cookie'].includes(name.toLowerCase()) && header.trim().length > 0,
    )
    if (hasCredentials && value.redirect !== 'error') {
      throw new DesktopError('InvalidInput', 'Credential-bearing file inputs must reject redirects')
    }
  }
  return value
}
