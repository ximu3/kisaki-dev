/** @fileoverview Defines the handshake, explicitly opened methods, notifications and safe failure boundary. */

import { RpcError, safeFailure } from '../errors'
import { isErrorSummary, type RpcProtocol } from '../frames'
import type { JsonValue } from '../json'

/** The acceptor checks context against the bound peer. A safe RpcError rejects the handshake. */
export type RpcHandshake =
  | {
      readonly role: 'initiator'
      readonly context: JsonValue
      /** Synchronously confirm the accepted context. Throw a safe RpcError for a specific refusal. */
      readonly accepts?: (context: JsonValue) => boolean
    }
  | {
      readonly role: 'acceptor'
      /** Return the accepted context after checking this transport's identity and permissions. */
      readonly accept: (context: JsonValue) => JsonValue
    }

/** Validate arguments and permissions here. Settle after the actual operation and its cleanup finish. */
export type RpcMethod = (
  args: readonly JsonValue[],
  signal: AbortSignal,
) => JsonValue | void | Promise<JsonValue | void>

/** Receive a known fact locally. The sender does not await its processing. */
export type RpcNotification = (value: JsonValue) => void | Promise<void>

/** Endpoints can deliver typed errors and validate a partial result against the invoked method. */
export interface RpcErrorCodec {
  /** Convert a local exception to public data. Keep credentials, stacks and causes local. */
  encode(error: unknown, method: string): JsonValue
  /** Recognize mechanism failures ({code, message}) and the endpoint's own safe failures. */
  decode(value: JsonValue, method: string): Error
}

/** Capabilities bound to one peer. Only own entries of the supplied tables are callable. */
export interface RpcEndpoint {
  readonly protocol: RpcProtocol
  readonly handshake: RpcHandshake
  readonly methods?: Readonly<Record<string, RpcMethod>>
  readonly notifications?: {
    readonly topics: Readonly<Record<string, RpcNotification>>
    /** Record a handler failure locally. The reporting hook owns its own errors. */
    readonly onError: (error: unknown, topic: string) => void
  }
  readonly errors?: RpcErrorCodec
}

export const defaultErrorCodec: RpcErrorCodec = {
  encode: safeFailure,
  decode(value) {
    if (isErrorSummary(value)) {
      return new RpcError(value.code, value.message)
    }
    return new RpcError('ProtocolViolation', 'Invalid RPC failure')
  },
}
