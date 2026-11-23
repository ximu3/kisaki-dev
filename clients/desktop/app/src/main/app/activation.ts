import { format, parse, type DeeplinkRequest } from '@kisaki3/desktop-contracts/deeplink'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import { readNotificationTarget } from '../infrastructure/notifications/target'

/** External links and native destinations share the current window's readiness and exit boundaries. */
export type ActivationRequest = DeeplinkRequest | { type: 'native'; target: NativeViewTarget }

/** Limits pending entry delivery without imposing a time limit on accepted business operations. */
export function createActivation(report: (cause: unknown) => void) {
  const queued = new Map<string, { request: ActivationRequest; timer: NodeJS.Timeout }>()
  let deliver: ((request: ActivationRequest) => Promise<void>) | undefined
  let accepting = true

  function clearPending() {
    for (const { timer } of queued.values()) {
      clearTimeout(timer)
    }
    queued.clear()
  }

  /** Admits one request, coalescing equivalent activations until the document is ready. */
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
      // Extension requests retain their own identity, including equivalent links.
      let key: string
      if (request.type === 'native') {
        key = 'native:' + JSON.stringify(request.target)
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
    receive(this: void, url: string) {
      receive(() => parse(url))
    },
    open(target: NativeViewTarget) {
      receive(() => ({ type: 'native', target }))
    },
    notification(appId: string, input: unknown) {
      receive(() => {
        const target = readNotificationTarget(appId, input)
        return target ? { type: 'native', target } : null
      })
    },

    /** Hands off all waiting requests to the newly bound receiver in their arrival order. */
    async ready(handler: (request: ActivationRequest) => Promise<void>) {
      deliver = handler
      const pending = [...queued.values()]
      clearPending()
      await Promise.all(pending.map(({ request }) => handler(request).catch(report)))
    },
    /** Keeps new requests queued while a replacement document establishes its receiver. */
    disconnected(this: void) {
      deliver = undefined
    },
    /** Stops admission at confirmed exit and restores only future requests after cancellation. */
    setAccepting(value: boolean) {
      accepting = value
      if (!value) {
        // A cancelled exit accepts new activations. The withdrawn requests do not replay.
        clearPending()
      }
    },
  }
}
