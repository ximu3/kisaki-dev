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
        /**
         * Attaches transferred-port messages and terminal port events to the renderer transport.
         */
        start(receive, closed) {
          /** Forwards transferred port data to the RPC transport receiver. */
          port.onmessage = (message) => receive(message.data)
          /** Reports MessagePort deserialization failure as transport closure. */
          port.onmessageerror = () => closed()
          port.addEventListener('close', () => closed(), { signal: listeners.signal })
        },

        /** Posts one encoded frame through the transferred renderer port. */
        send: (frame) => port.postMessage(frame),
        /** Releases the renderer transport listeners and its transferred message port. */
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
          /** Returns the synthetic value supplied by the independent main-process caller. */
          echo: ([value]) => value,
          /**
           * Reports active editing and returns a safe cancellation failure after the request is
           * aborted.
           */
          async edit(_args, signal) {
            rpc.notify('editing', null)
            await new Promise<void>((resolve) =>
              signal.addEventListener('abort', () => resolve(), { once: true }),
            )
            throw new RpcError('Cancelled', 'Edit cancelled in document')
          },
          /** Keeps one request active until the fixture window closes its connection. */
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
