/** Write a lifecycle message for the responsible domain. */
export function logLifecycle(domain: 'app' | 'extensions', message: string): void {
  console.info(`[${domain}] ${message}`)
}

/** Write the failure message for the operation's owner. */
export function logFailure(domain: 'app' | 'extensions', error: unknown): void {
  console.error(`[${domain}] ${error instanceof Error ? error.message : 'Unexpected failure'}`)
}
