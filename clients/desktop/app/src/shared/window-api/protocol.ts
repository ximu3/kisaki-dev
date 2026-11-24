import { DesktopError, parseExecutionFailure } from '@kisaki3/desktop-contracts/errors'
import { parseJsonValue } from '@kisaki3/desktop-contracts/json'
import { RpcError, type JsonValue, type RpcErrorCodec } from '@kisaki3/desktop-rpc'

export const windowKinds = ['main', 'reader', 'player', 'game-panel'] as const

export type WindowKind = (typeof windowKinds)[number]

export const windowProtocol = { id: 'kisaki.window', version: 1 } as const

export const fileChunkBytes = 64 * 1024

type RpcFields<T> = T extends JsonValue
  ? T
  : T extends (...args: never[]) => unknown
    ? T
    : T extends object
      ? { [K in keyof T]: RpcFields<T[K]> }
      : T

export function rpcData<T>(value: T): RpcFields<T> {
  return value as RpcFields<T>
}

export const windowErrors: RpcErrorCodec = {
  encode(error) {
    if (error instanceof RpcError) {
      return { code: error.code, message: error.message }
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return { code: 'Cancelled', message: 'The operation was cancelled' }
    }
    if (error instanceof DesktopError) {
      return {
        code: error.code,
        message: error.message,
        ...(Object.hasOwn(error, 'partialResult') && {
          partialResult: parseJsonValue(error.partialResult),
        }),
      }
    }
    return { code: 'OperationFailed', message: 'The operation could not be completed' }
  },
  decode(value) {
    const failure = parseExecutionFailure(value, parseJsonValue)
    return new DesktopError(failure.code, failure.message, failure)
  },
}
