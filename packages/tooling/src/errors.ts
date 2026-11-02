/** @fileoverview Preserves operation failures across cancellation and resource cleanup. */

/** Match the supplied signal's own cancellation, including Node's wrapped AbortError. */
export function isCancellation(cause: unknown, signal: AbortSignal): boolean {
  return (
    signal.aborted &&
    (cause === signal.reason ||
      (cause instanceof Error && cause.name === 'AbortError' && cause.cause === signal.reason))
  )
}

/** Finish owned cleanup before rethrowing the operation failure; retain both errors if cleanup fails. */
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
