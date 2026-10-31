/** @fileoverview Owns the public API version and the instance/document identities established by SDK endpoint handshakes. */

import * as v from 'valibot'
import { parse as parseVersion, satisfies, validRange } from 'semver'
import { ExecutionError } from '@kisaki3/desktop-contracts/errors'
import { objectSchema, nonemptyString, parse } from '../schema'

/** Product API identity is separate from npm versions and wire/endpoint protocol versions. */
export const extensionApiVersion = '1.0.0'
export const extensionNodeProtocol = { id: 'kisaki.extension-node', version: 1 } as const
export const extensionWebviewProtocol = { id: 'kisaki.extension-webview', version: 1 } as const

/** The supported range cannot select a different extension, view, or document. */
export interface ApiHello {
  readonly apiVersionRange: string
}
/** The host derives instance identity from the actual bound endpoint, never from the hello payload. */
export interface NodeAccepted {
  readonly apiVersion: string
  readonly instanceId: string
}
/** Each new document has its own binding, even when its owning view and Node instance remain alive. */
export interface WebviewAccepted extends NodeAccepted {
  readonly viewId: string
  readonly documentId: string
}

const version = v.pipe(
  nonemptyString,
  v.check((value) => {
    const parsed = parseVersion(value)
    return (
      parsed !== null &&
      value === parsed.version + (parsed.build.length ? `+${parsed.build.join('.')}` : '')
    )
  }),
)
const nodeAccepted = { apiVersion: version, instanceId: nonemptyString }

/** Parse only the declared SDK range; ownership fields cannot be supplied by the initiating caller. */
export function parseApiHello(input: unknown): ApiHello {
  return parse(
    objectSchema({
      apiVersionRange: v.pipe(
        nonemptyString,
        v.check((value) => validRange(value) !== null),
      ),
    }),
    input,
    'SDK hello',
  )
}
/** Validate accepted instance identity and API compatibility before exposing capabilities. */
export function parseNodeAccepted(input: unknown, supportedRange: string): NodeAccepted {
  const value = parse(objectSchema(nodeAccepted), input, 'Node SDK acceptance')
  requireCompatibleApi(value.apiVersion, supportedRange)
  return value
}
/** Validate the accepted view/document binding before using its private channel. */
export function parseWebviewAccepted(input: unknown, supportedRange: string): WebviewAccepted {
  const value = parse(
    objectSchema({ ...nodeAccepted, viewId: nonemptyString, documentId: nonemptyString }),
    input,
    'Webview SDK acceptance',
  )
  requireCompatibleApi(value.apiVersion, supportedRange)
  return value
}
/** Check a parsed API version against the supported range without protocol negotiation or fallback. */
export function requireCompatibleApi(actualVersion: string, supportedRange: string): void {
  if (!validRange(supportedRange) || !satisfies(actualVersion, supportedRange)) {
    throw new ExecutionError({
      code: 'ApiIncompatible',
      message: 'The extension API version is not supported by this SDK.',
    })
  }
}
