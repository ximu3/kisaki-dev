/** @fileoverview Queues only undelivered native entry requests while the main document is starting. */

import { format, parse, type DeeplinkRequest } from '@kisaki3/desktop-contracts/deeplink'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import { readNotificationTarget } from '../infrastructure/notifications/target'

/** External links and OS notification clicks share the window's readiness and exit boundaries. */
export type ActivationRequest = DeeplinkRequest | { type: 'notification'; target: NativeViewTarget }

/** Limits pending entry delivery without imposing a time limit on accepted business operations. */
export function createActivation(report: (cause: unknown) => void) {
  const queued = new Map<string, { request: ActivationRequest; timer: NodeJS.Timeout }>()
  let deliver: ((request: ActivationRequest) => Promise<void>) | undefined
  let accepting = true

  /** Withdraws unadmitted requests without replaying them after a cancelled exit. */
  function clear() {
    for (const { timer } of queued.values()) {
      clearTimeout(timer)
    }
    queued.clear()
  }

  /** Admits one request, coalescing only equivalent activations that are still waiting for startup. */
  function receive(read: () => ActivationRequest | null) {
    try {
      if (!accepting) {
        throw new DesktopError('Busy', 'The application is closing')
      }
      const request = read()
      if (!request) {
        return
      }
      if (deliver) {
        void deliver(request).catch(report)
        return
      }
      let key: string
      if (request.type === 'notification') {
        key = 'notification:' + JSON.stringify(request.target)
      } else {
        key = request.type === 'extension' ? crypto.randomUUID() : format(request)
      }
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
  }

  return {
    /** Parses the external link before any business or navigation receives it. */
    receive(this: void, url: string) {
      receive(() => parse(url))
    },
    /** Delivers the restored target immediately or with the initial document navigation. */
    notification(appId: string, input: unknown) {
      receive(() => {
        const target = readNotificationTarget(appId, input)
        return target ? { type: 'notification', target } : null
      })
    },
    /** Delivers startup navigation before revealing the main window's initial destination. */
    async ready(handler: (request: ActivationRequest) => Promise<void>) {
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
