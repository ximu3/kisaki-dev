// Host-side range access, incremental output checks, and lifecycle evidence.
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
const table = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

async function decode(config) {
  const storage = config.stageOutput ? await navigator.storage.getDirectory() : null
  const stagingName = 'kana-rar-proof-' + crypto.randomUUID()
  const staging = storage ? await storage.getDirectoryHandle(stagingName, { create: true }) : null
  const sinks = new Map()
  let stagingRemoved = false,
    stagedBytes = 0,
    publishedBytes = 0,
    checkedStoredBytes = 0
  const worker = new Worker('/decode-worker.mjs', { type: 'module' })
  const controllers = new Set()
  const operations = new Set()
  const members = []
  let workerDone = false
  let cancellationStarted = false
  let readCalls = 0,
    readBytes = 0,
    maxRead = 0,
    outputBytes = 0,
    maxOutput = 0
  let transfers = 0,
    maxTransfers = 0,
    lateMessages = 0,
    abortedFetches = 0
  let releaseHeldOutput
  let finish, fail
  const result = new Promise((resolve, reject) => {
    finish = resolve
    fail = reject
  })
  const timeout = setTimeout(() => fail(new Error('Decoder case timed out')), 20000)
  const startedAt = performance.now()
  const cancel = () => {
    cancellationStarted = true
    for (const controller of controllers) controller.abort()
    releaseHeldOutput?.()
    worker.postMessage({ kind: 'cancel' })
  }
  const handle = async (data) => {
    if (workerDone) {
      lateMessages++
      return
    }
    if (data.kind === 'entry') {
      members[data.index] = { ...data.entry, bytes: 0, checksum: 0xffffffff, chunks: [] }
      return
    }
    if (data.kind === 'phase') {
      if (config.hardStop && data.index === 0) {
        cancel()
        worker.terminate()
        finish({ hardTerminated: true })
      }
      return
    }
    if (data.kind === 'done') {
      finish(data)
      return
    }
    if (data.kind === 'fatal') {
      fail(new Error(data.reason))
      return
    }
    const reply = { kind: 'reply', id: data.id }
    transfers++
    maxTransfers = Math.max(maxTransfers, transfers)
    try {
      if (data.kind === 'read') {
        assert(Number.isSafeInteger(data.offset) && data.offset >= 0, 'Invalid requested offset')
        assert(data.length > 0 && data.length <= 65536, 'Unbounded decoder range')
        const name = data.path.slice('/source/'.length)
        const source = config.sources.find((item) => item.name === name)
        assert(source && data.path === '/source/' + name, 'Unregistered volume requested')
        const length = Math.min(data.length, Math.max(0, source.size - data.offset))
        let bytes = new Uint8Array()
        if (length) {
          const controller = new AbortController()
          controllers.add(controller)
          const held = config.cancelAt === 'read' && !cancellationStarted
          const url =
            '/fixture/' +
            encodeURIComponent(source.name) +
            '?size=' +
            source.size +
            (held ? '&delay=500' : '')
          const read = fetch(url, {
            headers: { Range: `bytes=${data.offset}-${data.offset + length - 1}` },
            signal: controller.signal
          })
          if (held) setTimeout(cancel, 20)
          try {
            const response = await read
            assert(response.status === 206, 'Source did not return a partial response')
            assert(
              response.headers.get('Content-Range') ===
                `bytes ${data.offset}-${data.offset + length - 1}/${source.size}`,
              'Source range metadata differs'
            )
            bytes = new Uint8Array(await response.arrayBuffer())
            assert(bytes.length === length, 'Source returned an incomplete range')
          } catch (error) {
            if (controller.signal.aborted) abortedFetches++
            throw error
          } finally {
            controllers.delete(controller)
          }
          readCalls++
          readBytes += bytes.length
          maxRead = Math.max(maxRead, bytes.length)
        }
        if (!cancellationStarted)
          worker.postMessage({ ...reply, buffer: bytes.buffer }, [bytes.buffer])
      } else if (data.kind === 'output') {
        const bytes = new Uint8Array(data.buffer)
        assert(bytes.length <= 65536, 'Unbounded decoder output')
        if (config.cancelAt === 'output' && outputBytes > 0 && !cancellationStarted) {
          const held = new Promise((resolve) => {
            releaseHeldOutput = resolve
          })
          setTimeout(cancel, 20)
          await held
          return
        }
        const member = members[data.entry]
        assert(member && !member.skipped, 'Skipped member leaked output')
        if (staging) {
          let sink = sinks.get(data.entry)
          if (!sink) {
            const handle = await staging.getFileHandle('member-' + data.entry, { create: true })
            sink = { handle, writable: await handle.createWritable(), settled: false }
            sinks.set(data.entry, sink)
          }
          await sink.writable.write(bytes)
          stagedBytes += bytes.length
        }
        member.bytes += bytes.length
        for (const byte of bytes)
          member.checksum = table[(member.checksum ^ byte) & 255] ^ (member.checksum >>> 8)
        // Only the four 4 KiB synthetic content fixtures are retained for an independent SHA check.
        if (config.checkSynthetic) member.chunks.push(bytes)
        outputBytes += bytes.length
        maxOutput = Math.max(maxOutput, bytes.length)
        await new Promise((resolve) => setTimeout(resolve, 1))
        if (!cancellationStarted) worker.postMessage(reply)
      }
    } catch {
      if (!cancellationStarted) worker.postMessage({ ...reply, failed: true })
    } finally {
      transfers--
    }
  }
  worker.onmessage = ({ data }) => {
    const operation = handle(data)
    operations.add(operation)
    operation.catch(fail).finally(() => operations.delete(operation))
  }
  worker.onerror = () => fail(new Error('Decoder worker failed'))
  worker.postMessage({ kind: 'start', ...config })
  try {
    const receipt = await result
    workerDone = true
    worker.terminate()
    for (const controller of controllers) controller.abort()
    releaseHeldOutput?.()
    await Promise.allSettled([...operations])
    assert(controllers.size === 0 && transfers === 0, 'Host work remained after close')
    const accepted = !receipt.failure && !receipt.cancelled && !receipt.hardTerminated
    for (const [index, sink] of sinks) {
      if (accepted) {
        await sink.writable.close()
        sink.settled = true
        const file = await sink.handle.getFile()
        assert(file.size === members[index].bytes, 'Stored member size differs')
        const reader = file.stream().getReader()
        let checksum = 0xffffffff
        try {
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            for (const byte of value) checksum = table[(checksum ^ byte) & 255] ^ (checksum >>> 8)
            checkedStoredBytes += value.length
          }
        } finally {
          reader.releaseLock()
        }
        assert(checksum === members[index].checksum, 'Stored member content differs')
        publishedBytes += file.size
      } else {
        await sink.writable.abort()
        sink.settled = true
      }
    }
    if (storage) {
      await storage.removeEntry(stagingName, { recursive: true })
      stagingRemoved = true
    }
    for (const member of members) {
      member.checksum = (member.checksum ^ 0xffffffff) >>> 0
      if (!receipt.failure && !receipt.cancelled && !receipt.hardTerminated && !member.skipped) {
        assert(member.bytes === member.size, 'Member output length differs')
        // Encrypted and split headers need independent fixture checks, not the first header CRC.
        if (member.hashType === 1 && !(member.flags & (32 | 4 | 3)))
          assert(member.checksum === member.crc, 'Independent member checksum differs')
      }
      if (member.chunks.length) {
        const bytes = new Uint8Array(member.bytes)
        let offset = 0
        for (const chunk of member.chunks) {
          bytes.set(chunk, offset)
          offset += chunk.length
        }
        member.sha256 = Array.from(
          new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
          (value) => value.toString(16).padStart(2, '0')
        ).join('')
      }
      delete member.chunks
    }
    const beforeQuiet = readCalls
    await new Promise((resolve) => setTimeout(resolve, 30))
    assert(readCalls === beforeQuiet && lateMessages === 0, 'Closed worker produced more work')
    return {
      ...receipt,
      members,
      id: config.id,
      sourceBytes: config.sources.reduce((sum, source) => sum + source.size, 0),
      readCalls,
      readBytes,
      maxRead,
      outputBytes,
      maxOutput,
      maxTransfers,
      abortedFetches,
      pendingHostReads: controllers.size,
      pendingHostTransfers: transfers,
      lateMessages,
      stagingUsed: !!staging,
      stagedBytes,
      publishedBytes,
      checkedStoredBytes,
      stagingRemoved,
      workerTerminated: true,
      elapsedMs: Math.round(performance.now() - startedAt)
    }
  } finally {
    clearTimeout(timeout)
    worker.terminate()
    for (const controller of controllers) controller.abort()
    releaseHeldOutput?.()
    for (const sink of sinks.values()) if (!sink.settled) await sink.writable.abort()
    if (storage && !stagingRemoved) await storage.removeEntry(stagingName, { recursive: true })
  }
}

globalThis.runRarProbe = decode
globalThis.probeReady = true
