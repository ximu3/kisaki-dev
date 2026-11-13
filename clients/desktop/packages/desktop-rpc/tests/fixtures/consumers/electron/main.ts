/** @fileoverview Verifies packed RPC over a transferred MessagePort, including loss of the actual window. */

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { app, BrowserWindow, MessageChannelMain } from 'electron'

/**
 * Verifies packed RPC over a transferred port, ending with loss of the actual fixture window.
 *
 * Releases the RPC connection on completion or failure; the caller owns the window.
 */
async function verifyChannel(window: BrowserWindow): Promise<void> {
  const { RpcConnection } = await import('@kisaki3/desktop-rpc')
  const { port1, port2 } = new MessageChannelMain()
  const cancel = new AbortController()
  let detach: () => void
  const rpc = new RpcConnection(
    {
      /** Attaches real Electron port delivery and window closure to the transport callbacks. */
      start(receive, closed) {
        /** Forwards Electron port data to the RPC receive callback. */
        const message = (event: Electron.MessageEvent) => receive(event.data)
        port1.on('message', message)
        port1.once('close', closed)
        window.once('closed', closed)
        /** Removes this fixture's port and window listeners. */
        detach = () => {
          port1.off('message', message)
          port1.off('close', closed)
          window.off('closed', closed)
        }
        port1.start()
      },

      /** Posts one encoded frame through the actual main-process message port. */
      send: (frame) => port1.postMessage(frame),
      /** Detaches the fixture listeners and closes the owned Electron message port. */
      close() {
        detach()
        port1.close()
      },
    },
    {
      protocol: { id: 'fixture.window', version: 1 },
      handshake: {
        role: 'acceptor',
        /** Accepts the isolated consumer peer with its synthetic main-process context. */
        accept: () => 'main',
      },
      notifications: {
        topics: {
          /** Cancels the request after the renderer confirms that editing has begun. */
          editing: () => cancel.abort(),
          /** Closes the fixture window after its pending request is established. */
          waiting: () => window.destroy(),
        },
        onError: console.error,
      },
    },
  )

  try {
    window.webContents.postMessage('fixture-port', null, [port2])
    assert.equal(await rpc.ready, 'document')

    const value = { nested: [false, null, '窓'] }
    assert.deepEqual(await rpc.request('echo', [value]), value)

    await assert.rejects(rpc.request('edit', [], { signal: cancel.signal }), {
      code: 'Cancelled',
      message: 'Edit cancelled in document',
    })

    await assert.rejects(rpc.request('waitForWindow'), { code: 'ConnectionClosed' })
    assert.equal(window.isDestroyed(), true)
  } finally {
    rpc.close()
  }
}

/** Creates the isolated fixture window and releases it after channel checks or failure. */
async function verifyWindow(): Promise<void> {
  await app.whenReady()
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      sandbox: true,
      contextIsolation: true,
    },
  })
  try {
    await window.loadFile(join(app.getAppPath(), 'dist/index.html'))
    await verifyChannel(window)
  } finally {
    if (!window.isDestroyed()) {
      window.destroy()
    }
  }
}

app.on('window-all-closed', () => {})
verifyWindow().then(
  () => app.exit(0),
  (error: unknown) => {
    console.error(error)
    app.exit(1)
  },
)
