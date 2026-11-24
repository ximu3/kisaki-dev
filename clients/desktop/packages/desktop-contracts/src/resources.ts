import * as v from 'valibot'
import { fromParser, id, text, nonemptyText, parseDictionary, parseValue } from './validation'
import { parseHttpUrl } from './network'
import { DesktopError } from './errors'

export interface ReadResourceRef {
  readonly id: string
}

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

export interface PreparedAttachment {
  readonly attachmentId: string
  readonly resource: ReadResourceRef

  dispose(): Promise<void>
}

export interface ReadResource {
  readonly resource: ReadResourceRef

  dispose(): Promise<void>
}

export interface ViewResourceBinding<K extends string = string> {
  readonly urls: Readonly<Record<K, string>>

  dispose(): Promise<void>
}

export interface ViewResourcesApi {
  bind<K extends string>(
    resources: Readonly<Record<K, ReadResourceRef>>,
  ): Promise<ViewResourceBinding<K>>
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
    url: fromParser(parseHttpUrl),
    headers: v.exactOptional(
      fromParser((value) => parseDictionary(headerName, headerValue, value)),
    ),
    redirect: v.exactOptional(v.picklist(['follow', 'error'])),
  }),
  v.strictObject({ type: v.literal('bytes'), bytes: v.instance(Uint8Array) }),
  v.strictObject({ type: v.literal('resource'), resource: resourceSchema }),
])

export function parseReadResourceRef(input: unknown): ReadResourceRef {
  return parseValue(resourceSchema, input, 'Invalid read resource reference')
}

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
