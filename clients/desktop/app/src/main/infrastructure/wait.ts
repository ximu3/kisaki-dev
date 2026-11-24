import { addAbortListener } from 'node:events'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

export async function waitFor<T>(result: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) {
    return result
  }
  signal.throwIfAborted()
  const cancelled = Promise.withResolvers<never>()
  const listener = addAbortListener(signal, () =>
    cancelled.reject(
      new DesktopError('Cancelled', 'The wait was cancelled', { cause: signal.reason }),
    ),
  )
  try {
    return await Promise.race([result, cancelled.promise])
  } finally {
    listener[Symbol.dispose]()
  }
}
