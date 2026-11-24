import { RpcError, safeFailure } from '../errors'
import { isErrorSummary, type RpcProtocol } from '../frames'
import type { JsonValue } from '../json'

export type RpcHandshake =
  | {
      readonly role: 'initiator'
      readonly context: JsonValue
      readonly accepts?: (context: JsonValue) => boolean
    }
  | {
      readonly role: 'acceptor'
      readonly accept: (context: JsonValue) => JsonValue
    }

export type RpcMethod = (
  args: readonly JsonValue[],
  signal: AbortSignal,
) => JsonValue | void | Promise<JsonValue | void>

export type RpcNotification = (value: JsonValue) => void | Promise<void>

export interface RpcErrorCodec {
  encode(error: unknown, method: string): JsonValue

  decode(value: JsonValue, method: string): Error
}

export interface RpcEndpoint {
  readonly protocol: RpcProtocol
  readonly handshake: RpcHandshake

  readonly methods?: Readonly<Record<string, RpcMethod>>
  readonly notifications?: {
    readonly topics: Readonly<Record<string, RpcNotification>>
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
