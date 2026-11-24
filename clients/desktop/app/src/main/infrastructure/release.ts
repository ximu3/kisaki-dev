export async function releaseAll(steps: readonly (() => unknown)[]): Promise<void> {
  const failures: unknown[] = []
  for (const step of steps) {
    try {
      await step()
    } catch (cause) {
      failures.push(cause)
    }
  }
  if (failures.length === 1) {
    throw failures[0]
  }
  if (failures.length) {
    throw new AggregateError(failures, 'Application cleanup failed')
  }
}

export async function rethrowAfterRelease(cause: unknown, release: () => unknown): Promise<never> {
  try {
    await release()
  } catch (cleanup) {
    const message = cause instanceof Error ? cause.message : String(cause)
    throw new AggregateError([cause, cleanup], message)
  }

  throw cause
}
