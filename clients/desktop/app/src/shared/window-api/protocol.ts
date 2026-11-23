import { DesktopError, parseExecutionFailure } from '@kisaki3/desktop-contracts/errors'
import { parseJsonValue } from '@kisaki3/desktop-contracts/json'
import { RpcError, type JsonValue, type RpcErrorCodec } from '@kisaki3/desktop-rpc'

/** The supported native document kinds. */
export const windowKinds = ['main', 'reader', 'player', 'game-panel'] as const

/** The kind bound by the main process to a specific webContents and preload. */
export type WindowKind = (typeof windowKinds)[number]

/** Protocol for calls after a real document has received its owned port. */
export const windowProtocol = { id: 'kisaki.window', version: 1 } as const

/** Maximum payload of a single pull on a document's binary file-input port. */
export const fileChunkBytes = 64 * 1024

/** Expands named DTO fields so TypeScript checks them against RPC's indexed JSON object type. */
type RpcFields<T> = T extends JsonValue
  ? T
  : T extends (...args: never[]) => unknown
    ? T
    : T extends object
      ? { [K in keyof T]: RpcFields<T[K]> }
      : T

/** Preserves the DTO itself. The transport snapshots and validates it at handoff. */
export function rpcData<T>(value: T): RpcFields<T> {
  return value as RpcFields<T>
}

/** Only safe operation failures cross the document boundary. */
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
