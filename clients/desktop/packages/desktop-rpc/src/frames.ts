/** @fileoverview Defines the closed wire vocabulary and validates each envelope at the receive boundary. */

import { RpcError } from './errors'
import { parseJsonValue, type JsonValue } from './json'

/** Version of the frame format and correlation rules implemented by this package. */
export const rpcWireVersion = 1

/**
 * Application-level protocol identity and numeric version, independent of the wire format.
 *
 * The version is a positive safe integer; the acceptor compares both fields exactly.
 */
export type RpcProtocol = { readonly id: string; readonly version: number }

/**
 * The closed message vocabulary of the version-one wire protocol.
 *
 * Request IDs are positive safe integers allocated independently in each direction. An omitted
 * success value represents void; explicit null remains data.
 */
export type RpcFrame =
  | {
      readonly type: 'hello'
      readonly wireVersion: typeof rpcWireVersion
      readonly protocol: RpcProtocol
      readonly context: JsonValue
    }
  | { readonly type: 'accepted'; readonly context: JsonValue }
  | {
      readonly type: 'rejected'
      readonly error: { readonly code: string; readonly message: string }
    }
  | {
      readonly type: 'request'
      readonly id: number
      readonly method: string
      readonly args: readonly JsonValue[]
    }
  | { readonly type: 'success'; readonly id: number; readonly value?: JsonValue }
  | { readonly type: 'failure'; readonly id: number; readonly error: JsonValue }
  | { readonly type: 'notify'; readonly topic: string; readonly value: JsonValue }
  | { readonly type: 'cancel'; readonly id: number }

/** Recognizes JSON objects, excluding arrays and null. */
function isRecord(value: JsonValue | undefined): value is { readonly [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Checks a parsed object's key count and ownership of every required field. */
function hasExactFields(value: object, ...fields: string[]): boolean {
  return (
    Object.keys(value).length === fields.length &&
    fields.every((field) => Object.hasOwn(value, field))
  )
}

/** Recognizes positive safe integers used by RPC versions and request IDs. */
function isPositiveInteger(value: JsonValue | undefined): boolean {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

/**
 * Recognizes the exact nonempty code/message shape shared by handshake and default call failures.
 */
export function isErrorSummary(
  value: JsonValue | undefined,
): value is { code: string; message: string } {
  return (
    isRecord(value) &&
    hasExactFields(value, 'code', 'message') &&
    typeof value.code === 'string' &&
    value.code.length > 0 &&
    typeof value.message === 'string' &&
    value.message.length > 0
  )
}

/** Recognizes a complete version-one envelope after JSON value validation. */
function isFrame(value: JsonValue): value is RpcFrame {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false
  }

  switch (value.type) {
    case 'hello': {
      const protocol = value.protocol
      return (
        hasExactFields(value, 'type', 'wireVersion', 'protocol', 'context') &&
        value.wireVersion === rpcWireVersion &&
        isRecord(protocol) &&
        hasExactFields(protocol, 'id', 'version') &&
        typeof protocol.id === 'string' &&
        isPositiveInteger(protocol.version)
      )
    }
    case 'accepted':
      return hasExactFields(value, 'type', 'context')
    case 'rejected':
      return hasExactFields(value, 'type', 'error') && isErrorSummary(value.error)
    case 'request':
      return (
        hasExactFields(value, 'type', 'id', 'method', 'args') &&
        isPositiveInteger(value.id) &&
        typeof value.method === 'string' &&
        Array.isArray(value.args)
      )
    case 'success':
      return (
        isPositiveInteger(value.id) &&
        (hasExactFields(value, 'type', 'id') || hasExactFields(value, 'type', 'id', 'value'))
      )
    case 'failure':
      return hasExactFields(value, 'type', 'id', 'error') && isPositiveInteger(value.id)
    case 'notify':
      return hasExactFields(value, 'type', 'topic', 'value') && typeof value.topic === 'string'
    case 'cancel':
      return hasExactFields(value, 'type', 'id') && isPositiveInteger(value.id)
    default:
      return false
  }
}

/** Detects a foreign wire version in a hello frame without inspecting its context. */
export function hasUnknownWireVersion(input: unknown): boolean {
  if (
    typeof input !== 'object' ||
    input === null ||
    Object.getOwnPropertyDescriptor(input, 'type')?.value !== 'hello'
  ) {
    return false
  }
  const version: unknown = Object.getOwnPropertyDescriptor(input, 'wireVersion')?.value
  return typeof version === 'number' && Number.isSafeInteger(version) && version !== rpcWireVersion
}

/**
 * Parses a complete frame in the supported wire format.
 *
 * Snapshots JSON-compatible data and rejects malformed values or envelopes with ProtocolViolation.
 * Connection state owns request ordering and correlation.
 */
export function parseRpcFrame(input: unknown): RpcFrame {
  try {
    const value = parseJsonValue(input)
    if (isFrame(value)) {
      return value
    }
  } catch (cause) {
    throw new RpcError('ProtocolViolation', 'Invalid RPC frame', { cause })
  }
  throw new RpcError('ProtocolViolation', 'Invalid RPC frame')
}
