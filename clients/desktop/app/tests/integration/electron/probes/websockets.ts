import { BrowserWindow, session } from 'electron'
import { createServer as createHttpsServer } from 'node:https'
import { createServer } from 'node:http'
import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { once } from 'node:events'
import type { AddressInfo, Socket } from 'node:net'
import assert from 'node:assert/strict'
import { createNetwork } from '../../../../src/main/infrastructure/network'

/** Uses a certificate trusted only by this test's ephemeral Chromium session. */
export async function verifyBrowserRoutes(directory: string) {
  const cert = await readFile(join(directory, 'loopback-cert.pem'), 'utf8')
  const key = await readFile(join(directory, 'loopback-key.pem'), 'utf8')
  const origin = createHttpsServer({ cert, key }, (_req, res) => res.end('loopback'))
  let connected: Socket | undefined
  let attempts = 0
  origin.on('upgrade', (request, socket) => {
    connected = socket as Socket
    const accept = createHash('sha1')
      .update(request.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64')
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' +
        accept +
        '\r\n\r\n',
    )
    socket.on('error', () => {})
  })
  const proxy = createServer((_req, res) => res.end('via proxy'))
  proxy.on('connect', (_request, socket) => {
    attempts++
    socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n')
  })
  const ses = session.fromPartition('test-websocket-' + randomUUID())
  const host = session.fromPartition('test-socket-host-' + randomUUID())
  const network = createNetwork(host, async () => null)
  ses.setCertificateVerifyProc(({ hostname, certificate }, done) =>
    done(hostname === '127.0.0.1' && certificate.data.trim() === cert.trim() ? 0 : -3),
  )
  const window = new BrowserWindow({
    show: false,
    webPreferences: { session: ses, sandbox: true, contextIsolation: true, nodeIntegration: false },
  })
  try {
    origin.listen(0, '127.0.0.1')
    await once(origin, 'listening')
    proxy.listen(0, '127.0.0.1')
    await once(proxy, 'listening')
    const authority = '127.0.0.1:' + (origin.address() as AddressInfo).port
    const target = JSON.stringify('wss://' + authority)
    const attemptConnection =
      'new Promise(resolve=>{const s=new WebSocket(' +
      target +
      ');s.onopen=()=>{s.close();resolve(true)};s.onerror=()=>resolve(false)})'
    await network.apply({
      status: 'ready',
      value: { mode: 'direct', endpoint: null, bypassRules: '', credentials: null },
    })
    await network.attach(ses)
    await window.loadURL('https://' + authority)
    await window.webContents.executeJavaScript(
      'new Promise((resolve,reject)=>{window.socket=new WebSocket(' +
        target +
        ');socket.onopen=()=>resolve(true);socket.onerror=()=>reject(new Error("initial connection failed"))})',
    )
    /** Waits for a fresh frame on the original browser socket, not just its reported readyState. */
    async function receive(value: string) {
      await window.webContents.executeJavaScript(
        'window.nextFrame=new Promise(resolve=>{socket.onmessage=e=>resolve(e.data)});true',
      )
      const bytes = Buffer.from(value)
      connected!.write(Buffer.concat([Buffer.from([0x81, bytes.length]), bytes]))
      assert.equal(await window.webContents.executeJavaScript('window.nextFrame'), value)
    }
    await network.apply({
      status: 'ready',
      value: {
        mode: 'manual',
        endpoint: 'http://127.0.0.1:' + (proxy.address() as AddressInfo).port,
        bypassRules: '<-loopback>',
        credentials: null,
      },
    })
    await receive('original connection')
    assert.equal(await window.webContents.executeJavaScript(attemptConnection), false)
    assert(attempts > 0, 'A new WSS handshake must reach the new proxy')
    const previous = attempts
    await network.apply({
      status: 'invalid',
      error: { code: 'DataIntegrityError', message: 'Invalid test route' },
    })
    await receive('still connected')
    assert.equal(await window.webContents.executeJavaScript(attemptConnection), false)
    assert.equal(attempts, previous)
  } finally {
    window.destroy()
    connected?.destroy()
    await network.close()
    for (const server of [origin, proxy]) {
      server.closeAllConnections()
      if (server.listening) {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        )
      }
    }
  }
}
