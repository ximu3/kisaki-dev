/** @fileoverview Defines the closed wire vocabulary and validates each envelope at the receive boundary. */

import { RpcError } from './errors'
import { parseJsonValue, type JsonValue } from './json'

/** Version of the frame format and correlation rules implemented by this package. */
export const rpcWireVersion = 1

/** Application protocol agreed by both endpoints, independently of the wire version. */
export type RpcProtocol = { readonly id: string; readonly version: number }

/** Complete messages carried by one ordered transport in either direction. */
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

function record(value: JsonValue | undefined): value is { readonly [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exact(value: object, ...fields: string[]): boolean {
  return (
    Object.keys(value).length === fields.length &&
    fields.every((field) => Object.hasOwn(value, field))
  )
}

function positiveInteger(value: JsonValue | undefined): boolean {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

/** The handshake and the default call-error codec share this exact public failure shape. */
export function isErrorSummary(
  value: JsonValue | undefined,
): value is { code: string; message: string } {
  return (
    record(value) &&
    exact(value, 'code', 'message') &&
    typeof value.code === 'string' &&
    value.code.length > 0 &&
    typeof value.message === 'string' &&
    value.message.length > 0
  )
}

function isFrame(value: JsonValue): value is RpcFrame {
  if (!record(value) || typeof value.type !== 'string') {
    return false
  }

  switch (value.type) {
    case 'hello': {
      const protocol = value.protocol
      return (
        exact(value, 'type', 'wireVersion', 'protocol', 'context') &&
        value.wireVersion === rpcWireVersion &&
        record(protocol) &&
        exact(protocol, 'id', 'version') &&
        typeof protocol.id === 'string' &&
        positiveInteger(protocol.version)
      )
    }
    case 'accepted':
      return exact(value, 'type', 'context')
    case 'rejected':
      return exact(value, 'type', 'error') && isErrorSummary(value.error)
    case 'request':
      return (
        exact(value, 'type', 'id', 'method', 'args') &&
        positiveInteger(value.id) &&
        typeof value.method === 'string' &&
        Array.isArray(value.args)
      )
    case 'success':
      return (
        positiveInteger(value.id) &&
        (exact(value, 'type', 'id') || exact(value, 'type', 'id', 'value'))
      )
    case 'failure':
      return exact(value, 'type', 'id', 'error') && positiveInteger(value.id)
    case 'notify':
      return exact(value, 'type', 'topic', 'value') && typeof value.topic === 'string'
    case 'cancel':
      return exact(value, 'type', 'id') && positiveInteger(value.id)
    default:
      return false
  }
}

/** Read only the version discriminator before interpreting a hello in the supported format. */
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

/** Parse a version-one frame whose fields and payload survive both wire encodings. */
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
