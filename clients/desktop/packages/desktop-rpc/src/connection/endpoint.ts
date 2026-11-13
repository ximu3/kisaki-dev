/** @fileoverview Defines the handshake, explicitly opened methods, notifications and safe failure boundary. */

import { RpcError, safeFailure } from '../errors'
import { isErrorSummary, type RpcProtocol } from '../frames'
import type { JsonValue } from '../json'

/**
 * Peer-context exchange for an initiating or accepting RPC endpoint.
 *
 * The acceptor checks the peer against the transport's bound identity and permissions. A safe
 * RpcError can identify a specific handshake refusal.
 */
export type RpcHandshake =
  | {
      readonly role: 'initiator'
      readonly context: JsonValue
      /**
       * Confirms accepted peer context synchronously; false rejects local readiness with
       * ProtocolMismatch.
       *
       * A thrown RpcError supplies a more specific local failure.
       */
      readonly accepts?: (context: JsonValue) => boolean
    }
  | {
      readonly role: 'acceptor'
      /**
       * Checks the initiating peer's context and returns this endpoint's context.
       *
       * Identity and permission checks use the transport binding. A safe RpcError rejects the
       * handshake.
       */
      readonly accept: (context: JsonValue) => JsonValue
    }

/**
 * Handler for one admitted RPC request.
 *
 * The handler owns argument and permission checks, receives the call's cancellation signal, and
 * settles after its operation and cleanup finish.
 */
export type RpcMethod = (
  args: readonly JsonValue[],
  signal: AbortSignal,
) => JsonValue | void | Promise<JsonValue | void>

/**
 * Handler for an unacknowledged fact notification.
 *
 * The sender does not wait for processing; local handler failures go to the endpoint's reporter.
 */
export type RpcNotification = (value: JsonValue) => void | Promise<void>

/** Endpoint-owned conversion between local errors and safe wire failures. */
export interface RpcErrorCodec {
  /**
   * Encodes a local failure as public data for the named method.
   *
   * Credentials, stacks and causes remain local. Method-specific partial results follow the
   * endpoint's contract.
   */
  encode(error: unknown, method: string): JsonValue

  /**
   * Decodes a failure for the named method, validating mechanism and endpoint-specific error data.
   */
  decode(value: JsonValue, method: string): Error
}

/**
 * Capabilities and handshake policy bound to one peer.
 *
 * Only own method and topic entries are dispatchable. The optional error codec owns public failure
 * values.
 */
export interface RpcEndpoint {
  readonly protocol: RpcProtocol
  readonly handshake: RpcHandshake

  readonly methods?: Readonly<Record<string, RpcMethod>>
  readonly notifications?: {
    readonly topics: Readonly<Record<string, RpcNotification>>
    /**
     * Receives notification failures for local reporting.
     *
     * The reporting implementation owns its own failures.
     */
    readonly onError: (error: unknown, topic: string) => void
  }

  readonly errors?: RpcErrorCodec
}

/** Safe public RPC failure encoding and decoding used when an endpoint supplies no custom codec. */
export const defaultErrorCodec: RpcErrorCodec = {
  encode: safeFailure,
  /**
   * Creates an RpcError from a valid code/message summary; malformed failures yield
   * ProtocolViolation.
   */
  decode(value) {
    if (isErrorSummary(value)) {
      return new RpcError(value.code, value.message)
    }

    return new RpcError('ProtocolViolation', 'Invalid RPC failure')
  },
}
