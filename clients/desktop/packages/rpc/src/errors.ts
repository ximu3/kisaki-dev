/** @fileoverview Defines safe mechanism failures without depending on product contracts. */

import type { JsonValue } from './json'

/** A classified RPC failure. Messages supplied by endpoints must be safe for the peer. */
export class RpcError extends Error {
  override readonly name = 'RpcError'

  constructor(
    readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}

/** Serialize known mechanism failures; arbitrary exceptions never expose their messages. */
export function serializeRpcError(error: unknown): JsonValue {
  if (error instanceof RpcError) {
    return { code: error.code, message: error.message }
  }
  return { code: 'OperationFailed', message: 'The operation could not be completed.' }
}

/** Restore the default safe failure shape; endpoints with business results supply a parser. */
export function parseRpcError(value: JsonValue): RpcError {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !('code' in value) ||
    typeof value.code !== 'string' ||
    !('message' in value) ||
    typeof value.message !== 'string' ||
    Object.keys(value).some((key) => key !== 'code' && key !== 'message')
  ) {
    throw new RpcError('ProtocolViolation', 'The peer sent an invalid failure.')
  }
  return new RpcError(value.code, value.message)
}
