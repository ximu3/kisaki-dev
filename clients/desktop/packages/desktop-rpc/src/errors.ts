/** @fileoverview Keeps safe wire failures separate from local exceptions and endpoint-specific results. */

/** A recognizable failure with a public code and a message safe to send to the peer. */
export class RpcError extends Error {
  readonly code: string

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RpcError'
    this.code = code
  }
}

/** Only explicitly public failures may supply their own text on the wire. */
export function safeFailure(error: unknown): { code: string; message: string } {
  if (error instanceof RpcError && error.code && error.message) {
    return { code: error.code, message: error.message }
  }
  return { code: 'OperationFailed', message: 'The operation failed' }
}

export function connectionClosed(cause?: unknown): RpcError {
  return new RpcError('ConnectionClosed', 'The RPC connection closed', { cause })
}
