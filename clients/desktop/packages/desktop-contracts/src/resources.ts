/** @fileoverview Separates transient file inputs, acquired content and view-bound resource addresses. */

import * as v from 'valibot'
import { id, text, nonemptyText, parseDictionary, parseValue } from './validation'
import { parseHttpUrl } from './network'
import { DesktopError } from './errors'

/** Opaque reference to acquired, fixed content whose authority is checked for the actual caller. */
export interface ReadResourceRef {
  readonly id: string
}

/** Transient source for one file operation, supplied as a path, URL, bytes or acquired resource. */
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

/** Verified, retained content awaiting adoption under a host-allocated attachment ID. */
export interface PreparedAttachment {
  readonly attachmentId: string
  readonly resource: ReadResourceRef

  /**
   * Releases this preparation hold idempotently.
   *
   * Adopted references and other holders remain valid.
   */
  dispose(): Promise<void>
}

/** Owned hold on fixed readable content with an asynchronous release operation. */
export interface ReadResource {
  readonly resource: ReadResourceRef

  /**
   * Stops new reads through this handle and waits for in-flight cleanup.
   *
   * Repeated disposal has no further effect, and other holders remain valid.
   */
  dispose(): Promise<void>
}

/** View-owned transient URLs backed by holds independent of the original resource holder. */
export interface ViewResourceBinding<K extends string = string> {
  readonly urls: Readonly<Record<K, string>>

  /** Revokes this binding's URLs and releases its holds while preserving other view bindings. */
  dispose(): Promise<void>
}

/** Binding of acquired content to transient addresses usable by the actual view. */
export interface ViewResourcesApi {
  /**
   * Acquires independent view holds and returns resource URLs under the original input keys.
   *
   * Failure cleans partial bindings while preserving the caller's holds.
   */
  bind<K extends string>(
    resources: Readonly<Record<K, ReadResourceRef>>,
  ): Promise<ViewResourceBinding<K>>
}

/** Opaque resource identity whose access and lifetime are checked by the owning runtime. */
const resourceSchema = v.strictObject({ id })

/** HTTP token syntax accepted for an explicitly supplied request header name. */
const headerName = v.pipe(text, v.regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/))

/** Request header text that excludes line breaks and NUL. */
const headerValue = v.pipe(
  text,
  v.check((value) => !/[\r\n\0]/.test(value)),
)

/** Local-path, HTTP-request or owned-resource input selected for file preparation. */
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

/**
 * Parses an opaque resource reference's shape.
 *
 * The host checks existence, ownership and expiry.
 */
export function parseReadResourceRef(input: unknown): ReadResourceRef {
  return parseValue(resourceSchema, input, 'Invalid read resource reference')
}

/**
 * Checks a preparation handle's interface and returns the original object with its methods intact.
 *
 * The host verifies actual authority and ownership of the hold.
 */
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
 * Parses a transient source and checks credential-bearing HTTP redirect policy.
 *
 * Nonempty Authorization or Cookie headers, matched case-insensitively, require explicit redirect:
 * error. Resource acquisition and authority checks belong to execution.
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
