/** @fileoverview Defines and strictly parses the finite version-one RPC message vocabulary. */

import { RpcError } from './errors'
import { isJsonValue, type JsonObject, type JsonValue } from './json'

/** Version of the frame format and request-correlation rules implemented by this package. */
export const rpcWireVersion = 1

/** An endpoint-owned protocol identity, independent of package and product API versions. */
export interface RpcProtocol {
  readonly id: string
  readonly version: number
}

/** Version-one frames. Request IDs are directional positive safe integers. */
export type RpcFrame =
  | {
      readonly type: 'hello'
      readonly wireVersion: 1
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

/** Parse one frame, rejecting unknown keys and values that JSON would silently change. */
export function parseRpcFrame(input: unknown): RpcFrame {
  // Read only the minimal envelope before interpreting an unfamiliar wire version.
  if (input !== null && typeof input === 'object') {
    const type = Object.getOwnPropertyDescriptor(input, 'type')
    const version = Object.getOwnPropertyDescriptor(input, 'wireVersion')
    if (
      type?.value === 'hello' &&
      version &&
      'value' in version &&
      version.value !== rpcWireVersion
    ) {
      throw new RpcError('ProtocolMismatch', 'The RPC wire version is not supported.')
    }
  }
  if (!isJsonValue(input) || !isObject(input)) {
    return invalidFrame()
  }

  const type = input.type
  if (typeof type !== 'string') {
    return invalidFrame()
  }
  switch (type) {
    case 'hello':
      if (
        keys(input, ['type', 'wireVersion', 'protocol', 'context']) &&
        input.wireVersion === rpcWireVersion &&
        isObject(input.protocol) &&
        keys(input.protocol, ['id', 'version']) &&
        nonempty(input.protocol.id) &&
        positiveInteger(input.protocol.version)
      ) {
        return {
          type: 'hello',
          wireVersion: rpcWireVersion,
          protocol: { id: input.protocol.id, version: input.protocol.version },
          context: input.context,
        }
      }
      break
    case 'accepted':
      if (keys(input, ['type', 'context'])) {
        return { type: 'accepted', context: input.context }
      }
      break
    case 'rejected':
      if (
        keys(input, ['type', 'error']) &&
        isObject(input.error) &&
        keys(input.error, ['code', 'message']) &&
        nonempty(input.error.code) &&
        typeof input.error.message === 'string'
      ) {
        return { type: 'rejected', error: { code: input.error.code, message: input.error.message } }
      }
      break
    case 'request':
      if (
        keys(input, ['type', 'id', 'method', 'args']) &&
        positiveInteger(input.id) &&
        nonempty(input.method) &&
        Array.isArray(input.args)
      ) {
        return { type: 'request', id: input.id, method: input.method, args: input.args }
      }
      break
    case 'success':
      if (keys(input, ['type', 'id'], ['value']) && positiveInteger(input.id)) {
        return input.value === undefined
          ? { type: 'success', id: input.id }
          : { type: 'success', id: input.id, value: input.value }
      }
      break
    case 'failure':
      if (keys(input, ['type', 'id', 'error']) && positiveInteger(input.id)) {
        return { type: 'failure', id: input.id, error: input.error }
      }
      break
    case 'notify':
      if (keys(input, ['type', 'topic', 'value']) && nonempty(input.topic)) {
        return { type: 'notify', topic: input.topic, value: input.value }
      }
      break
    case 'cancel':
      if (keys(input, ['type', 'id']) && positiveInteger(input.id)) {
        return { type: 'cancel', id: input.id }
      }
      break
  }
  return invalidFrame()
}

function isObject(value: JsonValue | undefined): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function keys<Key extends string>(
  value: JsonObject,
  required: readonly Key[],
  optional: readonly string[] = [],
): value is JsonObject & Record<Key, JsonValue> {
  const allowed: readonly string[] = required
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => allowed.includes(key) || optional.includes(key))
  )
}

function positiveInteger(value: JsonValue | undefined): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function nonempty(value: JsonValue | undefined): value is string {
  return typeof value === 'string' && value.length > 0
}

function invalidFrame(): never {
  throw new RpcError('ProtocolViolation', 'The peer sent an invalid RPC frame.')
}
