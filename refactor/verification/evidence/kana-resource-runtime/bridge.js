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
  let remoteReader
  let sourceEnded = false
  let readingEnded = false
  let terminal = false
  let cancellation
  const finish = () => {
    if (terminal || !sourceEnded || !readingEnded) return
    terminal = true
    peer.stop()
    port.close()
    ended.resolve()
    cancellation?.resolve()
  }
  const loseOwner = () => {
    observations.ownerLost = (observations.ownerLost || 0) + 1
    metadata.resolve({ status: 410, size: 0 })
    controller.error(new Error('Resource owner is unavailable.'))
    remoteReader?.cancel().catch(() => {})
    sourceEnded = true
    readingEnded = true
    finish()
  }
  const peer = watchTransferPeer(isOwnerAlive, loseOwner)
  const stop = async (reason) => {
    if (terminal) return
    if (cancellation) return cancellation.promise
    cancellation = deferred()
    readingEnded = true
    if (reason !== 'consumer') controller.error(new Error('Resource delivery ended.'))
    if (!(await isOwnerAlive())) {
      loseOwner()
      return cancellation.promise
    }
    remoteReader?.cancel().catch(() => {})
    port.postMessage({ type: 'cancel', reason })
    finish()
    return cancellation.promise
  }
  const stream = new ReadableStream(
    {
      start(value) {
        controller = value
      },
      async pull() {
        peer.touch()
        const meta = await metadata.promise
        if (terminal || cancellation || meta.status !== 200) return
        try {
          const next = await remoteReader.read()
          if (terminal || cancellation) return
          if (next.done) {
            controller.close()
            readingEnded = true
            finish()
          } else {
            observations.chunks++
            observations.maxChunk = Math.max(observations.maxChunk, next.value.byteLength)
            controller.enqueue(next.value)
          }
        } catch {
          await stop('stream')
        }
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
      if (data.status === 200) remoteReader = data.stream.getReader()
      else {
        controller.close()
        sourceEnded = true
        readingEnded = true
      }
      metadata.resolve(data)
      if (cancellation) remoteReader?.cancel().catch(() => {})
      finish()
    } else if (data.type === 'ended') {
      sourceEnded = true
      finish()
    }
  }
  port.onmessageerror = () => {
    metadata.resolve({ status: 500, size: 0 })
    stop('message')
  }
  return { metadata: metadata.promise, stream, ended: ended.promise, stop }
}

function serveBytes(port, source, parentSignal, budget, observations, dispose, isPeerAlive) {
  const readController = new AbortController()
  const ended = deferred()
  let streamController
  let offset = 0
  let currentRead = null
  let terminal = false
  let ending
  const peer = watchTransferPeer(isPeerAlive, () => {
    observations.peerLost = (observations.peerLost || 0) + 1
    finish('peerLost')
  })
  const finish = (reason) => {
    if (ending) return ending
    terminal = true
    peer.stop()
    readController.abort()
    if (reason) streamController.error(new Error('Resource delivery ended.'))
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
      if (releaseFailed) streamController.error(new Error('Resource release failed.'))
      else if (!reason) streamController.close()
      port.postMessage({ type: 'ended', releaseFailed })
      port.close()
      ended.resolve({ releaseFailed })
    })()
    return ending
  }
  const stream = new ReadableStream(
    {
      start(controller) {
        streamController = controller
      },
      async pull(controller) {
        if (terminal) return
        peer.touch()
        currentRead = (async () => {
          const length = Math.min(CHUNK_BYTES, source.size - offset)
          const release = await budget.acquire(readController.signal)
          try {
            const borrowed = await source.read(offset, length, readController.signal)
            if (readController.signal.aborted) return
            if (borrowed.byteLength !== length)
              throw new Error('The byte source returned a short read.')
            // Bound the retained backing buffer without detaching the provider's bytes.
            controller.enqueue(borrowed.slice())
            observations.bytes += length
            observations.reads++
            observations.maxRead = Math.max(observations.maxRead, length)
            if (borrowed.byteLength !== length) throw new Error('Provider bytes were detached.')
            offset += length
          } finally {
            release()
          }
        })()
        try {
          await currentRead
        } catch {
          currentRead = null
          if (!terminal) await finish('readFailed')
          return
        }
        currentRead = null
        if (!terminal && offset === source.size) await finish()
      },
      cancel() {
        if (!terminal) observations.consumerCancellations++
        return finish('consumer')
      }
    },
    { highWaterMark: 0 }
  )
  const parentAbort = () => finish('closed')
  parentSignal.addEventListener('abort', parentAbort, { once: true })
  port.onmessage = ({ data }) => {
    peer.touch()
    if (data.type === 'cancel' && !terminal) {
      observations.consumerCancellations++
      finish(data.reason)
    }
  }
  if (parentSignal.aborted) parentAbort()
  else {
    try {
      port.postMessage(
        { type: 'meta', size: source.size, status: 200, mime: source.mime, stream },
        [stream]
      )
    } catch {
      port.postMessage({ type: 'meta', status: 500, size: 0 })
      finish('transfer')
    }
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
