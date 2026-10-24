// A version-scoped service worker holds only active byte transfers.
importScripts('bridge.js')
const scope = new URL(self.registration.scope)
const bootId = crypto.randomUUID()
const observations = { chunks: 0, maxChunk: 0, streamCancelled: 0, requestAborted: 0, active: 0 }

self.addEventListener('message', (event) => {
  if (event.data?.type === 'identity') {
    event.ports[0].postMessage({
      ownerId: event.source.id,
      version: scope.pathname.split('/').filter(Boolean).at(-1),
      bootId,
      observations
    })
  } else if (event.data?.type === 'direct-stream') {
    // The same bridge is consumed without Fetch to isolate its own queueing behavior.
    const [consumerPort, sourcePort] = event.ports
    const receive = byteBridge.receiveBytes(sourcePort, async () => true, observations)
    event.waitUntil(receive.ended)
    const read = receive.stream.getReader()
    consumerPort.onmessage = async ({ data }) => {
      if (data.type === 'pull') {
        const next = await read.read()
        consumerPort.postMessage(next, next.value ? [next.value.buffer] : [])
      } else if (data.type === 'cancel') {
        await read.cancel()
        consumerPort.postMessage({ cancelled: true })
        consumerPort.close()
      }
    }
    consumerPort.start()
  }
})

self.addEventListener('fetch', (event) => {
  const complete = {}
  complete.promise = new Promise((resolve) => {
    complete.resolve = resolve
  })
  event.waitUntil(complete.promise)
  event.respondWith(
    respond(event).finally(() => {
      if (!complete.streaming) complete.resolve()
    })
  )
  async function respond() {
    const url = new URL(event.request.url)
    if (
      url.protocol !== scope.protocol ||
      url.host !== scope.host ||
      !url.pathname.startsWith(scope.pathname)
    ) {
      return new Response(null, { status: 403 })
    }
    const [ownerId, token, ...parts] = url.pathname.slice(scope.pathname.length).split('/')
    if (!ownerId || !token || parts[0] !== 'book' || event.request.method !== 'GET') {
      return new Response(null, { status: 403 })
    }
    if (event.request.mode !== 'navigate') {
      const client = await clients.get(event.clientId)
      if (!client?.url.startsWith(`${scope.href}${ownerId}/${token}/`)) {
        return new Response(null, { status: 403 })
      }
    }
    const owner = await clients.get(ownerId)
    if (!owner) return new Response(null, { status: 410 })
    const channel = new MessageChannel()
    const receive = byteBridge.receiveBytes(
      channel.port1,
      async () => !!(await clients.get(ownerId)),
      observations
    )
    observations.active++
    complete.streaming = true
    receive.ended.finally(() => {
      observations.active--
      complete.resolve()
    })
    event.request.signal.addEventListener(
      'abort',
      () => {
        observations.requestAborted++
        receive.stop('request')
      },
      { once: true }
    )
    owner.postMessage(
      { type: 'open-resource', token, path: '/' + parts.join('/'), search: url.search, bootId },
      [channel.port2]
    )
    const meta = await receive.metadata
    if (meta.status !== 200) return new Response(null, { status: meta.status })
    return new Response(receive.stream, {
      headers: {
        'Content-Type': meta.mime,
        'Content-Length': String(meta.size),
        'Cache-Control': 'no-store',
        'Content-Security-Policy': `default-src 'none'; connect-src ${scope.href}; style-src 'unsafe-inline' ${scope.href}; img-src ${scope.href}; font-src ${scope.href}; frame-ancestors 'self'; base-uri 'none'; form-action 'none'`
      }
    })
  }
})
