/** @fileoverview Queues only undelivered native entry requests while the main document is starting. */

import { format, parse, type DeeplinkRequest } from '@kisaki3/desktop-contracts/deeplink'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

/** Limits pending entry delivery without imposing a time limit on accepted business operations. */
export function createActivation(report: (cause: unknown) => void) {
  const queued = new Map<string, { request: DeeplinkRequest; timer: NodeJS.Timeout }>()
  let deliver: ((request: DeeplinkRequest) => Promise<void>) | undefined
  let accepting = true

  /** Withdraws unadmitted requests without replaying them after a cancelled exit. */
  function clear() {
    for (const { timer } of queued.values()) {
      clearTimeout(timer)
    }
    queued.clear()
  }

  return {
    /** Parses OS input immediately and coalesces equivalent undelivered native destinations. */
    receive(url: string) {
      try {
        if (!accepting) {
          throw new DesktopError('Busy', 'The application is closing')
        }
        const request = parse(url)
        if (deliver) {
          void deliver(request).catch(report)
          return
        }
        const key = request.type === 'extension' ? crypto.randomUUID() : format(request)
        if (queued.has(key)) {
          return
        }
        if (queued.size >= 32) {
          throw new DesktopError('Busy', 'Too many application links are waiting')
        }
        const timer = setTimeout(() => {
          queued.delete(key)
          report(
            new DesktopError(
              'OperationFailed',
              'The application link expired before its destination was ready',
            ),
          )
        }, 60_000)
        timer.unref()
        queued.set(key, { request, timer })
      } catch (error) {
        report(error)
      }
    },
    /** Delivers startup navigation before revealing the main window's initial destination. */
    async ready(handler: (request: DeeplinkRequest) => Promise<void>) {
      deliver = handler
      const pending = [...queued.values()]
      clear()
      for (const { request } of pending) {
        try {
          await handler(request)
        } catch (error) {
          report(error)
        }
      }
    },
    /** Stops admission at confirmed exit and restores only future requests after cancellation. */
    setAccepting(value: boolean) {
      accepting = value
      if (!value) {
        clear()
      }
    },
  }
}
