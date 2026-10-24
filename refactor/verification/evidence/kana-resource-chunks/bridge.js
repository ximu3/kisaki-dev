// Pull-driven byte transport specimen shared by the owner page and its service worker.
const CHUNK_BYTES = 64 * 1024

function deferred() {
  let resolve
  let reject
  const promise = new Promise((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}

function watchTransferPeer(checkAlive, onLost) {
  if (!checkAlive) return { touch() {}, stop() {} }
  let timer
  let stopped = false
  let checking = false
  const controller = new AbortController()
  const touch = () => {
    clearTimeout(timer)
    if (stopped || checking) return
    timer = setTimeout(async () => {
      checking = true
      try {
        const alive = await checkAlive(controller.signal)
        if (!stopped && !alive) onLost()
      } catch {
        if (!stopped) onLost()
      } finally {
        checking = false
        if (!stopped) touch()
      }
    }, 1000)
  }
  touch()
  return {
    touch,
    stop() {
      stopped = true
      clearTimeout(timer)
      controller.abort()
    }
  }
}

function receiveBytes(port, isOwnerAlive, observations) {
  const metadata = deferred()
  const ended = deferred()
  let controller
  let pull
  let cancellation
  let terminal = false
  const peer = watchTransferPeer(isOwnerAlive, () => {
    observations.ownerLost = (observations.ownerLost || 0) + 1
    metadata.resolve({ status: 410, size: 0 })
    controller.error(new Error('Resource owner is unavailable.'))
    finish()
    cancellation?.resolve()
  })
  const finish = () => {
    if (terminal) return
    terminal = true
    peer.stop()
    port.close()
    pull?.resolve()
    ended.resolve()
  }
  const stop = async (reason) => {
    if (terminal) return
    if (cancellation) return cancellation.promise
    cancellation = deferred()
    if (reason === 'request') controller.error(new Error('Resource request was cancelled.'))
    if (!(await isOwnerAlive())) {
      metadata.resolve({ status: 410, size: 0 })
      finish()
      cancellation.resolve()
      return
    }
    port.postMessage({ type: 'cancel', reason })
    return cancellation.promise
  }
  const stream = new ReadableStream(
    {
      type: 'bytes',
      start(value) {
        controller = value
      },
      async pull() {
        if (terminal) return
        if (!(await isOwnerAlive())) {
          controller.error(new Error('Resource owner is unavailable.'))
          finish()
          return
        }
        pull = deferred()
        port.postMessage({ type: 'pull' })
        return pull.promise
      },
      cancel() {
        observations.streamCancelled++
        return stop('consumer')
      }
    },
    { highWaterMark: 0 }
  )
  port.onmessage = ({ data }) => {
    peer.touch()
    if (data.type === 'meta') {
      metadata.resolve(data)
      if (data.status !== 200 || data.size === 0) {
        controller.close()
        finish()
      }
    } else if (data.type === 'chunk') {
      observations.chunks++
      observations.maxChunk = Math.max(observations.maxChunk, data.bytes.byteLength)
      if (!terminal && !cancellation) controller.enqueue(data.bytes)
      pull?.resolve()
      pull = null
      if (data.last) {
        if (!cancellation) controller.close()
        finish()
      }
    } else if (data.type === 'error') {
      metadata.resolve({ status: data.reason === 'closed' ? 410 : 500, size: 0 })
      if (!cancellation) controller.error(new Error('Resource delivery ended.'))
      finish()
      cancellation?.resolve()
    } else if (data.type === 'cancelled') {
      finish()
      cancellation?.resolve()
    }
  }
  port.onmessageerror = () => {
    metadata.reject(new Error('Resource transport failed.'))
    controller.error(new Error('Resource transport failed.'))
    finish()
  }
  return { metadata: metadata.promise, stream, ended: ended.promise, stop }
}

function serveBytes(port, source, parentSignal, budget, observations, dispose, isPeerAlive) {
  const controller = new AbortController()
  const ended = deferred()
  let offset = 0
  let currentRead = null
  let terminal = false
  let ending = null
  const peer = watchTransferPeer(isPeerAlive, () => {
    observations.peerLost = (observations.peerLost || 0) + 1
    finish({ type: 'error', reason: 'peerLost' })
  })
  const finish = (reason) => {
    if (ending) return ending
    terminal = true
    peer.stop()
    controller.abort()
    ending = (async () => {
      await currentRead?.catch(() => {})
      parentSignal.removeEventListener('abort', parentAbort)
      let releaseFailed = false
      try {
        await dispose()
        observations.released++
      } catch {
        releaseFailed = true
        observations.releaseFailures = (observations.releaseFailures || 0) + 1
      }
      if (releaseFailed) port.postMessage({ type: 'error', reason: 'releaseFailed' })
      else if (reason) port.postMessage(reason)
      port.close()
      ended.resolve({ releaseFailed })
    })()
    return ending
  }
  const parentAbort = () => finish({ type: 'error', reason: 'closed' })
  parentSignal.addEventListener('abort', parentAbort, { once: true })
  port.onmessage = ({ data }) => {
    peer.touch()
    if (data.type === 'cancel') {
      observations.consumerCancellations++
      finish({ type: 'cancelled' })
      return
    }
    if (data.type !== 'pull' || terminal) return
    if (currentRead) throw new Error('The probe received concurrent demands for one stream.')
    currentRead = (async () => {
      const length = Math.min(CHUNK_BYTES, source.size - offset)
      const release = await budget.acquire(controller.signal)
      try {
        const borrowed = await source.read(offset, length, controller.signal)
        if (controller.signal.aborted) return
        if (borrowed.byteLength !== length)
          throw new Error('The byte source returned a short read.')
        // ByteSource buffers remain valid for their provider; only this copy is transferred.
        const bytes = borrowed.slice()
        observations.bytes += length
        observations.reads++
        observations.maxRead = Math.max(observations.maxRead, length)
        offset += length
        port.postMessage({ type: 'chunk', bytes, last: offset === source.size }, [bytes.buffer])
        if (bytes.byteLength !== 0 || borrowed.byteLength !== length) {
          throw new Error('The byte transport violated buffer ownership.')
        }
      } finally {
        release()
      }
    })()
    currentRead.then(
      () => {
        currentRead = null
        if (!terminal && offset === source.size) finish()
      },
      () => {
        currentRead = null
        if (!terminal) finish({ type: 'error', reason: 'readFailed' })
      }
    )
  }
  if (parentSignal.aborted) parentAbort()
  else {
    port.postMessage({ type: 'meta', size: source.size, status: 200, mime: source.mime })
    if (source.size === 0) finish()
  }
  return { ended: ended.promise }
}

function createReadBudget(limit) {
  let active = 0
  const queue = []
  const stats = { active: 0, peak: 0, queued: 0, peakQueued: 0 }
  const dispatch = () => {
    while (active < limit && queue.length) {
      const item = queue.shift()
      stats.queued = queue.length
      item.signal.removeEventListener('abort', item.abort)
      active++
      stats.active = active
      stats.peak = Math.max(stats.peak, active)
      let released = false
      item.resolve(() => {
        if (released) throw new Error('A read permit was released twice.')
        released = true
        stats.active = --active
        dispatch()
      })
    }
  }
  return {
    stats,
    acquire(signal, priority = 0) {
      if (signal.aborted) return Promise.reject(new DOMException('', 'AbortError'))
      return new Promise((resolve, reject) => {
        const item = { resolve, reject, signal, priority }
        item.abort = () => {
          const index = queue.indexOf(item)
          if (index >= 0) queue.splice(index, 1)
          stats.queued = queue.length
          reject(new DOMException('', 'AbortError'))
        }
        signal.addEventListener('abort', item.abort, { once: true })
        const before = queue.findIndex((queued) => queued.priority > priority)
        if (before < 0) queue.push(item)
        else queue.splice(before, 0, item)
        stats.queued = queue.length
        stats.peakQueued = Math.max(stats.peakQueued, queue.length)
        dispatch()
      })
    }
  }
}

globalThis.byteBridge = { CHUNK_BYTES, receiveBytes, serveBytes, createReadBudget }
