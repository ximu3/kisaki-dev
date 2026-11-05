/** @fileoverview Runs the packed browser entry on the port transferred into a sandboxed document. */

import { RpcConnection, RpcError } from '@kisaki3/desktop-rpc'

window.addEventListener(
  'message',
  (event) => {
    if (event.source !== window || event.data !== 'fixture-port') {
      return
    }
    const port = event.ports[0]!
    const listeners = new AbortController()
    const rpc = new RpcConnection(
      {
        start(receive, closed) {
          port.onmessage = (message) => receive(message.data)
          port.onmessageerror = () => closed()
          port.addEventListener('close', () => closed(), { signal: listeners.signal })
        },
        send: (frame) => port.postMessage(frame),
        close() {
          listeners.abort()
          port.onmessage = null
          port.onmessageerror = null
          port.close()
        },
      },
      {
        protocol: { id: 'fixture.window', version: 1 },
        handshake: { role: 'initiator', context: 'document' },
        methods: {
          echo: ([value]) => value,
          async edit(_args, signal) {
            rpc.notify('editing', null)
            await new Promise<void>((resolve) =>
              signal.addEventListener('abort', () => resolve(), { once: true }),
            )
            throw new RpcError('Cancelled', 'Edit cancelled in document')
          },
          async waitForWindow() {
            rpc.notify('waiting', null)
            await rpc.closed
          },
        },
      },
    )
    rpc.ready.catch((error: unknown) => console.error(error))
  },
  { once: true },
)
