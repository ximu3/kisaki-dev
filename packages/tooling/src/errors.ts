/** @fileoverview Preserves operation failures across cancellation and resource cleanup. */

/**
 * Recognizes cancellation from the supplied aborted signal, including Node's AbortError wrapper.
 */
export function isCancellation(cause: unknown, signal: AbortSignal): boolean {
  return (
    signal.aborted &&
    (cause === signal.reason ||
      (cause instanceof Error && cause.name === 'AbortError' && cause.cause === signal.reason))
  )
}

/**
 * Finishes cleanup before rejecting with the operation failure.
 *
 * A cleanup failure produces an AggregateError containing both errors.
 */
export async function rethrowAfterCleanup(
  cause: unknown,
  cleanup: () => Promise<unknown>,
  message: string,
): Promise<never> {
  try {
    await cleanup()
  } catch (cleanupFailure) {
    throw new AggregateError([cause, cleanupFailure], message, { cause: cleanupFailure })
  }

  throw cause
}
