// Mechanism specimen: route requests to a live owner without storing publication state here.
const bootId = crypto.randomUUID()
const scopePath = new URL(self.registration.scope).pathname

self.addEventListener('message', (event) => {
  if (event.data?.type === 'identify') {
    event.ports[0].postMessage({ ownerId: event.source.id, bootId })
  }
})

self.addEventListener('fetch', (event) => {
  event.respondWith(resolveRequest(event))
})

async function resolveRequest(event) {
  const request = event.request
  const url = new URL(request.url)
  const scope = new URL(self.registration.scope)
  if (
    url.protocol !== scope.protocol ||
    url.host !== scope.host ||
    !url.pathname.startsWith(scopePath) ||
    request.method !== 'GET'
  ) {
    return new Response(null, { status: 403 })
  }
  const [ownerId, token, ...parts] = url.pathname.slice(scopePath.length).split('/')
  if (!ownerId || !token) return new Response(null, { status: 404 })
  if (request.mode !== 'navigate') {
    const client = await self.clients.get(event.clientId)
    const expectedRoot = `${self.registration.scope}${ownerId}/${token}/`
    if (!client?.url.startsWith(expectedRoot)) return new Response(null, { status: 403 })
  }
  if (parts[0] !== 'book') return new Response(null, { status: 403 })
  const owner = await self.clients.get(ownerId)
  if (!owner) return new Response(null, { status: 410 })
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    const finish = (response) => {
      clearTimeout(timeout)
      channel.port1.close()
      resolve(response)
    }
    const timeout = setTimeout(() => finish(new Response(null, { status: 504 })), 10000)
    channel.port1.onmessage = ({ data }) => {
      finish(
        new Response(data.body ?? null, {
          status: data.status,
          headers: { ...data.headers, 'Cache-Control': 'no-store', 'X-Probe-Boot': bootId }
        })
      )
    }
    owner.postMessage(
      { type: 'resource', token, path: '/' + parts.join('/'), search: url.search },
      [channel.port2]
    )
  })
}
