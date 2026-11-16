/** @fileoverview Exercises the deployed host HTTP implementation against an isolated origin and its authenticating proxy. */

import { session } from 'electron'
import { createServer, type Server } from 'node:http'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { createNetwork } from '../../../../src/main/infrastructure/network'

/** Listens only on a loopback port allocated to this test process. */
async function listen(server: Server) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return 'http://127.0.0.1:' + (server.address() as AddressInfo).port
}

/** Verifies body consumption, explicit account headers, proxy challenges and blocking on a failed apply. */
export async function verifyNetwork() {
  const host = session.fromPartition('test-network-' + randomUUID())
  const browser = session.fromPartition('test-browser-' + randomUUID())
  const network = createNetwork(host, async () => ({ username: 'test', password: 'example' }))
  const origin = createServer((req, res) => {
    if (req.url === '/stream') {
      res.setHeader('Content-Type', 'text/plain')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.flushHeaders()
      res.write('first')
      return
    }
    if (req.url === '/upload') {
      req.pipe(res)
      return
    }
    if (req.url === '/redirect') {
      res.writeHead(302, { location: '/echo' })
      res.end()
      return
    }
    res.setHeader('Set-Cookie', ['one=1; Path=/', 'two=2; Path=/'])
    res.end(req.headers.cookie ?? 'no-cookie')
  })
  const proxy = createServer((req, res) => {
    if (
      req.headers['proxy-authorization'] !==
      'Basic ' + Buffer.from('test:example').toString('base64')
    ) {
      res.writeHead(407, { 'Proxy-Authenticate': 'Basic realm="local test"' })
      res.end()
      return
    }
    res.end('via proxy')
  })
  try {
    const url = await listen(origin)
    const endpoint = await listen(proxy)
    await network.apply({
      status: 'ready',
      value: { mode: 'direct', endpoint: null, bypassRules: '', credentials: null },
    })
    await network.attach(browser)
    await host.cookies.set({ url, name: 'ambient', value: 'test' })
    const redirected = await network.fetch(url + '/redirect')
    assert.equal(redirected.url, url + '/echo')
    assert.equal(redirected.redirected, true)
    assert.equal(await redirected.text(), 'no-cookie')
    assert.equal(redirected.headers.getSetCookie().length, 2)
    await assert.rejects(redirected.text())
    const authenticated = await network.fetch(url + '/echo', {
      headers: { cookie: 'explicit=1' },
      redirect: 'error',
    })
    assert.equal(await authenticated.text(), 'explicit=1')
    const body = new ReadableStream<Uint8Array>({
      /** Provides one finite streamed upload to the loopback endpoint. */
      start(controller) {
        controller.enqueue(new TextEncoder().encode('chunked'))
        controller.close()
      },
    })
    assert.equal(
      await (await network.fetch(url + '/upload', { method: 'POST', body })).text(),
      'chunked',
    )
    const response = await network.fetch(url + '/stream')
    const reader = response.body!.getReader()
    assert.equal(new TextDecoder().decode((await reader.read()).value), 'first')
    const interrupted = assert.rejects(reader.read())
    await assert.rejects(network.fetch(url + '/redirect', { redirect: 'error' }))
    await network.apply({
      status: 'ready',
      value: {
        mode: 'manual',
        endpoint,
        bypassRules: '<-loopback>',
        credentials: { revision: 'test' },
      },
    })
    const routed = await network.fetch(url + '/echo')
    await interrupted
    assert.equal(await routed.text(), 'via proxy')
    await network.apply({
      status: 'invalid',
      error: { code: 'DataIntegrityError', message: 'Invalid test route' },
    })
    await assert.rejects(network.fetch(url + '/echo'))
    await assert.rejects(browser.fetch(url + '/echo'))
  } finally {
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
