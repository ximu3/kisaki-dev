export function isCancellation(cause: unknown, signal: AbortSignal): boolean {
  return (
    signal.aborted &&
    (cause === signal.reason ||
      (cause instanceof Error && cause.name === 'AbortError' && cause.cause === signal.reason))
  )
}

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
