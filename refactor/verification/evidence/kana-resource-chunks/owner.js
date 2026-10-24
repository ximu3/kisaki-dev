// The page retains source ownership, read admission, and per-content cancellation.
const mounts = new Map()
const registrations = new Map()
const allSources = []
let routingId
const budget = byteBridge.createReadBudget(4)
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const check = (value, message) => {
  if (!value) throw new Error(message)
}
const ask = (worker, data, signal) =>
  new Promise((resolve, reject) => {
    const channel = new MessageChannel()
    const abort = () => {
      channel.port1.close()
      reject(new DOMException('', 'AbortError'))
    }
    if (signal?.aborted) {
      abort()
      return
    }
    signal?.addEventListener('abort', abort, { once: true })
    channel.port1.onmessage = ({ data: reply }) => {
      signal?.removeEventListener('abort', abort)
      channel.port1.close()
      resolve(reply)
    }
    worker.postMessage(data, [channel.port2])
  })

async function prepare(version) {
  if (!isSecureContext || !navigator.serviceWorker) {
    throw Object.assign(new Error('Content workers require a supported secure context.'), {
      reason: 'assetUnavailable'
    })
  }
  const root = new URL(`/assets/${version}/`, location.href)
  const workerUrl = new URL('worker.js', root).href
  let available
  try {
    available = await navigator.serviceWorker.getRegistrations()
  } catch (cause) {
    throw Object.assign(new Error('Content worker registration is unavailable.', { cause }), {
      reason: 'assetUnavailable'
    })
  }
  const existing = available.find((item) => item.scope === root.href)
  if (existing) {
    const workers = [existing.active, existing.installing, existing.waiting].filter(Boolean)
    if (workers.some((worker) => worker.scriptURL !== workerUrl)) {
      throw Object.assign(new Error('Content worker scope is already owned.'), {
        reason: 'assetUnavailable'
      })
    }
  }
  let registration
  try {
    registration =
      (existing?.active ? existing : null) ||
      (await navigator.serviceWorker.register(workerUrl, {
        scope: root.href,
        updateViaCache: 'none'
      }))
  } catch (cause) {
    throw Object.assign(new Error('Content worker is unavailable.', { cause }), {
      reason: 'assetUnavailable'
    })
  }
  const worker = registration.active || registration.installing || registration.waiting
  if (worker.state !== 'activated') {
    await new Promise((resolve, reject) => {
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') resolve()
        if (worker.state === 'redundant') reject(new Error('Content worker activation failed.'))
      })
    })
  }
  const identity = await ask(registration.active, { type: 'identity' })
  check(identity.version === version, 'The content worker identity is inconsistent.')
  registrations.set(version, registration)
  return { scope: root.href, workerUrl, identity }
}

function pattern(offset, length) {
  const owned = new Uint8Array(length + 16)
  const view = owned.subarray(8, 8 + length)
  for (let i = 0; i < length; i++) view[i] = (offset + i) % 251
  return view
}

function source(options = {}) {
  const stats = {
    bytes: 0,
    reads: 0,
    maxRead: 0,
    released: 0,
    leases: 0,
    consumerCancellations: 0,
    abortObserved: 0,
    inflight: 0,
    peakInflight: 0,
    pendingSettled: 0,
    borrowedSize: 0
  }
  const size = options.size ?? options.bytes?.byteLength ?? 2 * 1024 * 1024
  const value = {
    size,
    metadataDelay: options.metadataDelay || 0,
    failOpen: !!options.failOpen,
    failDispose: !!options.failDispose,
    mime: options.mime || 'application/octet-stream',
    async read(offset, length, signal) {
      check(offset >= 0 && length >= 0 && offset + length <= size, 'Invalid fixture range.')
      stats.inflight++
      stats.peakInflight = Math.max(stats.peakInflight, stats.inflight)
      try {
        if (options.delay && !(options.firstChunkImmediate && offset === 0)) {
          await new Promise((resolve, reject) => {
            const done = () => {
              signal.removeEventListener('abort', abort)
              resolve()
            }
            const timer = setTimeout(done, options.delay)
            const abort = () => {
              clearTimeout(timer)
              stats.abortObserved++
              setTimeout(
                () => reject(new DOMException('', 'AbortError')),
                options.settleAfterAbort || 0
              )
            }
            if (signal.aborted) abort()
            else signal.addEventListener('abort', abort, { once: true })
          })
        }
        if (signal.aborted) throw new DOMException('', 'AbortError')
        if (options.failAt !== undefined && offset >= options.failAt) {
          throw Object.assign(new Error('Controlled source failed.'), { reason: 'readFailed' })
        }
        const bytes = options.bytes
          ? options.bytes.subarray(offset, offset + length)
          : pattern(offset, length)
        stats.borrowedSize = bytes.byteLength
        return bytes
      } finally {
        stats.inflight--
        stats.pendingSettled++
      }
    },
    stats
  }
  allSources.push(value)
  return value
}

const textSource = (text, mime) => source({ bytes: new TextEncoder().encode(text), mime })

function waitForSetup(setup, signal) {
  if (!signal) return setup
  return new Promise((resolve, reject) => {
    const abort = () =>
      reject(Object.assign(new Error('Opening was cancelled.'), { reason: 'cancelled' }))
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
    setup.then(
      (value) => {
        signal.removeEventListener('abort', abort)
        resolve(value)
      },
      (error) => {
        signal.removeEventListener('abort', abort)
        reject(error)
      }
    )
  })
}

async function mount(version = 'v1', options = {}, signal) {
  if (signal?.aborted) {
    throw Object.assign(new Error('Opening was cancelled.'), { reason: 'cancelled' })
  }
  const prepared = await waitForSetup(prepare(version), signal)
  routingId ||= crypto.randomUUID()
  const token = `${routingId}.${crypto.randomUUID()}`
  const controller = new AbortController()
  const files = new Map([
    [
      '/book/index.html',
      textSource(
        '<!doctype html><link rel="stylesheet" href="style.css"><p id="ready">Native content</p>',
        'text/html'
      )
    ],
    ['/book/style.css', textSource('@import "nested/rules.css";', 'text/css')],
    ['/book/nested/rules.css', textSource('#ready{color:rgb(12,34,56)}', 'text/css')],
    ['/book/data.bin', source(options)]
  ])
  const base = `${prepared.scope}${prepared.identity.ownerId}/${token}/`
  const value = {
    token,
    base,
    version,
    controller,
    files,
    transfers: new Set(),
    releaseFailures: 0
  }
  mounts.set(token, value)
  return { token, base, version }
}

navigator.serviceWorker.addEventListener('message', ({ data, source: worker, ports }) => {
  if (
    data?.type !== 'open-resource' ||
    !ports[0] ||
    !routingId ||
    typeof data.token !== 'string' ||
    !data.token.startsWith(`${routingId}.`)
  )
    return
  const port = ports[0]
  const mount = mounts.get(data.token)
  if (!mount || registrations.get(mount.version)?.active.scriptURL !== worker.scriptURL) {
    port.postMessage({ type: 'meta', status: 410, size: 0 })
    port.close()
    return
  }
  const item = mount.files.get(data.path)
  if (!item) {
    port.postMessage({ type: 'meta', status: 404, size: 0 })
    port.close()
    return
  }
  const task = (async () => {
    if (item.metadataDelay) {
      await new Promise((resolve) => {
        const end = () => {
          clearTimeout(timer)
          mount.controller.signal.removeEventListener('abort', end)
          resolve()
        }
        const timer = setTimeout(end, item.metadataDelay)
        mount.controller.signal.addEventListener('abort', end, { once: true })
      })
    }
    if (mount.controller.signal.aborted) {
      port.postMessage({ type: 'meta', status: 410, size: 0 })
      port.close()
      return
    }
    if (item.failOpen) throw new Error('Controlled resource opening failure.')
    item.stats.leases++
    const transfer = byteBridge.serveBytes(
      port,
      item,
      mount.controller.signal,
      budget,
      item.stats,
      async () => {
        item.stats.leases--
        if (item.failDispose) throw new Error('Controlled resource release failure.')
      },
      async (signal) => {
        const identity = await ask(worker, { type: 'identity' }, signal)
        return identity.bootId === data.bootId
      }
    )
    return transfer.ended
  })().catch(() => {
    item.stats.openFailures = (item.stats.openFailures || 0) + 1
    port.postMessage({ type: 'meta', status: 500, size: 0 })
    port.close()
    return { openFailed: true }
  })
  mount.transfers.add(task)
  task.then(
    (result) => {
      mount.transfers.delete(task)
      if (result?.releaseFailed) mount.releaseFailures++
    },
    () => {
      mount.transfers.delete(task)
      mount.releaseFailures++
    }
  )
})

async function close(token) {
  const value = mounts.get(token)
  if (!value) return
  mounts.delete(token)
  value.controller.abort()
  const settled = await Promise.allSettled([...value.transfers])
  if (value.releaseFailures || settled.some((result) => result.status === 'rejected')) {
    throw Object.assign(new Error('Content resource cleanup failed.'), { reason: 'readFailed' })
  }
}

async function frameAt(url) {
  const frame = document.createElement('iframe')
  frame.width = '400'
  frame.height = '300'
  const loaded = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Content frame did not load.')), 15000)
    frame.onload = () => {
      clearTimeout(timeout)
      resolve()
    }
  })
  frame.src = url
  document.body.append(frame)
  await loaded
  return frame
}

async function until(predicate, message, limit = 3000) {
  const start = performance.now()
  while (!predicate()) {
    if (performance.now() - start > limit) throw new Error(message)
    await wait(10)
  }
}

async function finish() {
  await Promise.all([...mounts.keys()].map(close))
  document.querySelectorAll('iframe').forEach((frame) => frame.remove())
  const owned = (await navigator.serviceWorker.getRegistrations()).filter(
    (registration) =>
      registration.scope.includes('/assets/') || registration.active?.scriptURL.endsWith('/pwa.js')
  )
  await Promise.all(owned.map((registration) => registration.unregister()))
  return {
    mounts: mounts.size,
    leases: allSources.reduce((sum, item) => sum + item.stats.leases, 0),
    inflight: allSources.reduce((sum, item) => sum + item.stats.inflight, 0),
    budget: { ...budget.stats },
    caches: await caches.keys()
  }
}

async function portEvents() {
  const channel = new MessageChannel()
  let observed = false
  channel.port1.addEventListener('close', () => {
    observed = true
  })
  channel.port1.start()
  const exposed = 'onclose' in channel.port1
  channel.port2.close()
  await wait(50)
  channel.port1.close()
  const transfers = new MessageChannel()
  const stream = new ReadableStream(
    {
      pull(controller) {
        controller.enqueue(new Uint8Array([37]))
        controller.close()
      }
    },
    { highWaterMark: 0 }
  )
  let transferableStream = false
  let transferFailure = null
  try {
    const received = new Promise((resolve) => {
      transfers.port1.onmessage = async ({ data }) => {
        const read = data.getReader()
        const first = await read.read()
        await read.cancel()
        resolve(first.value[0] === 37)
      }
    })
    transfers.port2.postMessage(stream, [stream])
    transferableStream = await received
  } catch (error) {
    transferFailure = error.name
    if (!stream.locked) await stream.cancel()
  } finally {
    transfers.port1.close()
    transfers.port2.close()
  }
  return {
    closeEventObserved: observed,
    oncloseExposed: exposed,
    transferableStream,
    transferFailure
  }
}

globalThis.runtimeProbe = {
  prepare,
  mount,
  close,
  frameAt,
  until,
  source,
  textSource,
  pattern,
  ask,
  wait,
  check,
  finish,
  portEvents,
  mounts,
  registrations,
  allSources,
  budget
}
