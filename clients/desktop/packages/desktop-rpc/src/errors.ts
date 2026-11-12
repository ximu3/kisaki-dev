/** @fileoverview Keeps safe wire failures separate from local exceptions and endpoint-specific results. */

/**
 * A local error whose code and message are explicitly safe for peer delivery.
 *
 * Callers supply public text; the optional cause remains local.
 */
export class RpcError extends Error {
  readonly code: string

  /** Stores a public code/message pair and optional local error details. */
  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RpcError'
    this.code = code
  }
}

/**
 * Builds a wire-safe failure summary.
 *
 * Preserves nonempty code and message values from RpcError; other failures become OperationFailed
 * with generic text.
 */
export function safeFailure(error: unknown): { code: string; message: string } {
  if (error instanceof RpcError && error.code && error.message) {
    return { code: error.code, message: error.message }
  }

  return { code: 'OperationFailed', message: 'The operation failed' }
}

/** Creates the standard connection-loss failure while retaining its local cause. */
export function connectionClosed(cause?: unknown): RpcError {
  return new RpcError('ConnectionClosed', 'The RPC connection closed', { cause })
}
