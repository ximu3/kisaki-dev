export class RpcError extends Error {
  readonly code: string

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RpcError'
    this.code = code
  }
}

export function safeFailure(error: unknown): { code: string; message: string } {
  if (error instanceof RpcError && error.code && error.message) {
    return { code: error.code, message: error.message }
  }

  return { code: 'OperationFailed', message: 'The operation failed' }
}

export function connectionClosed(cause?: unknown): RpcError {
  return new RpcError('ConnectionClosed', 'The RPC connection closed', { cause })
}
