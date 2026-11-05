/** @fileoverview Verifies packed RPC over a transferred MessagePort, including loss of the actual window. */

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { app, BrowserWindow, MessageChannelMain } from 'electron'

/** Transfer a dedicated port to the loaded document and observe its real channel lifetime. */
async function verifyChannel(window: BrowserWindow): Promise<void> {
  const { RpcConnection } = await import('@kisaki3/desktop-rpc')
  const { port1, port2 } = new MessageChannelMain()
  const cancel = new AbortController()
  let detach: () => void
  const rpc = new RpcConnection(
    {
      start(receive, closed) {
        const message = (event: Electron.MessageEvent) => receive(event.data)
        port1.on('message', message)
        port1.once('close', closed)
        window.once('closed', closed)
        detach = () => {
          port1.off('message', message)
          port1.off('close', closed)
          window.off('closed', closed)
        }
        port1.start()
      },
      send: (frame) => port1.postMessage(frame),
      close() {
        detach()
        port1.close()
      },
    },
    {
      protocol: { id: 'fixture.window', version: 1 },
      handshake: { role: 'acceptor', accept: () => 'main' },
      notifications: {
        topics: { editing: () => cancel.abort(), waiting: () => window.destroy() },
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

/** Create the isolated test window and release it on either success or failure. */
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
