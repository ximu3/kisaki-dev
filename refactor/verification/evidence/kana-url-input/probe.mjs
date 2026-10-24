// This private protocol probe is not the public openUrlSource implementation.
class SourceFailure extends Error {
  constructor(code, cause) {
    super('URL source proof operation failed.', { cause })
    this.code = code
  }
}
const fail = (code) => {
  throw new SourceFailure(code)
}
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
const matchesStrongEtagFormat = (value) =>
  value !== null && /^"[\x21\x23-\x7e\x80-\xff]*"$/.test(value)
const parseContentRange = (value) => {
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(value ?? '')
  if (!match) return null
  const [start, end, total] = match.slice(1).map(Number)
  return [start, end, total].every(Number.isSafeInteger) && start <= end && end < total
    ? { start, end, total }
    : null
}
const canInspectContentCoding = (response, credentials) => {
  if (response.headers.get('content-encoding') !== null) return true
  if (response.type === 'basic' || response.type === 'default') return true
  const exposed = (response.headers.get('access-control-expose-headers') ?? '')
    .toLowerCase()
    .split(',')
    .map((value) => value.trim())
  return (
    exposed.includes('content-encoding') || (credentials !== 'include' && exposed.includes('*'))
  )
}
const usesFileBytes = (response, credentials) =>
  canInspectContentCoding(response, credentials) && !response.headers.get('content-encoding')
const cancelBody = async (response) => {
  try {
    await response?.body?.cancel()
  } catch {
    /* A failed or already aborted body needs no further consumption. */
  }
}

async function temporaryStorage() {
  const root = await navigator.storage.getDirectory()
  const directory = await root.getDirectoryHandle('kana-url-proof', { create: true })
  const live = new Set()
  let created = 0,
    writes = 0,
    removed = 0
  return {
    async create() {
      const name = crypto.randomUUID() + '.bin'
      const handle = await directory.getFileHandle(name, { create: true })
      live.add(name)
      created++
      let writer
      try {
        writer = await handle.createWritable()
      } catch (error) {
        await directory.removeEntry(name)
        live.delete(name)
        removed++
        throw error
      }
      let finished = false,
        disposed = false,
        file = null
      return {
        async write(offset, data) {
          await writer.write({ type: 'write', position: offset, data })
          writes++
        },
        async finish() {
          await writer.close()
          finished = true
          file = await handle.getFile()
        },
        async read(offset, length) {
          return new Uint8Array(await file.slice(offset, offset + length).arrayBuffer())
        },
        async dispose() {
          if (disposed) return
          disposed = true
          if (!finished) await writer.abort()
          await directory.removeEntry(name)
          live.delete(name)
          removed++
        }
      }
    },
    stats() {
      return { created, writes, removed, live: live.size }
    }
  }
}

async function openStableForProof(url, storage, options = {}) {
  const life = new AbortController()
  const pending = new Set()
  const credentials = options.credentials ?? 'same-origin'
  let closed = false,
    changed = false,
    closing = null,
    file = null
  const check = (signal) => {
    if (closed) fail('closed')
    if (changed) fail('sourceChanged')
    if (signal?.aborted) fail('cancelled')
  }
  const guarded = async (signal, operation) => {
    try {
      check(signal)
      return await operation(AbortSignal.any([life.signal, ...(signal ? [signal] : [])]))
    } catch (error) {
      if (error instanceof SourceFailure) throw error
      check(signal)
      throw new SourceFailure('readFailed', error)
    }
  }
  const changedSource = () => {
    changed = true
    life.abort()
    fail('sourceChanged')
  }
  const fetchPart = (headers, signal) =>
    fetch(url, { headers, signal, credentials, cache: 'no-store' })
  const readExact = async (response, expected, signal) => {
    const reader = response.body.getReader()
    const output = new Uint8Array(expected)
    let offset = 0
    try {
      while (true) {
        check(signal)
        const result = await reader.read()
        if (result.done) break
        if (result.value.length > expected - offset) fail('readFailed')
        output.set(result.value, offset)
        offset += result.value.length
      }
      if (offset !== expected) fail('readFailed')
      return output
    } catch (error) {
      try {
        await reader.cancel()
      } catch {}
      throw error
    } finally {
      reader.releaseLock()
    }
  }
  let size, prefix, metadata, mode, initialUrl, validator
  try {
    await guarded(options.signal, async (signal) => {
      globalThis.urlProofDetail = 'fetch-probe'
      let response,
        probeTransportFailed = false
      try {
        response = await fetchPart({ Range: 'bytes=0-15' }, signal)
      } catch {
        check(options.signal)
        probeTransportFailed = true
        response = await fetchPart({}, signal)
      }
      const range = parseContentRange(response.headers.get('content-range'))
      const tag = response.headers.get('etag')
      metadata = {
        responseType: response.type,
        probeTransportFailed,
        etagReadable: tag !== null,
        rangeReadable: range !== null,
        codingVisibilityProven: canInspectContentCoding(response, credentials),
        contentEncoding: response.headers.get('content-encoding'),
        contentLength: response.headers.get('content-length')
      }
      if (
        !probeTransportFailed &&
        response.status === 206 &&
        matchesStrongEtagFormat(tag) &&
        range &&
        range.start === 0 &&
        range.end === Math.min(15, range.total - 1) &&
        usesFileBytes(response, credentials)
      ) {
        prefix = await readExact(response, range.end + 1, signal)
        size = range.total
        initialUrl = response.url
        validator = tag
        mode = 'range'
        return
      }
      if (response.status === 206 || response.status === 416) {
        await cancelBody(response)
        response = await fetchPart({}, signal)
      }
      if (response.status !== 200) {
        await cancelBody(response)
        fail('readFailed')
      }
      mode = 'snapshot'
      globalThis.urlProofDetail = 'create-snapshot'
      file = await storage.create()
      size = 0
      const reader = response.body.getReader()
      try {
        while (true) {
          check(options.signal)
          globalThis.urlProofDetail = 'read-snapshot-stream'
          const result = await reader.read()
          if (result.done) break
          if (result.value.length > (options.snapshotLimit ?? 8192) - size) fail('resourceLimit')
          globalThis.urlProofDetail = 'write-snapshot'
          await file.write(size, result.value)
          size += result.value.length
          options.onSnapshotWrite?.(size)
        }
        check(options.signal)
        globalThis.urlProofDetail = 'finish-snapshot'
        await file.finish()
      } catch (error) {
        try {
          await reader.cancel()
        } catch {}
        throw error
      } finally {
        reader.releaseLock()
      }
    })
  } catch (error) {
    life.abort()
    if (file) await file.dispose()
    throw error
  }
  const read = (offset, length, signal) => {
    const task = guarded(signal, async (combined) => {
      if (
        ![offset, length].every(Number.isSafeInteger) ||
        offset < 0 ||
        length < 0 ||
        offset > size ||
        length > size - offset
      )
        fail('invalidInput')
      if (!length) return new Uint8Array()
      if (mode === 'snapshot') {
        const bytes = await file.read(offset, length)
        check(signal)
        return bytes
      }
      if (offset + length <= prefix.length) return prefix.slice(offset, offset + length)
      const response = await fetchPart(
        { Range: `bytes=${offset}-${offset + length - 1}`, 'If-Match': validator },
        combined
      )
      try {
        if (response.status === 412 || response.url !== initialUrl) changedSource()
        const tag = response.headers.get('etag')
        if (matchesStrongEtagFormat(tag) && tag !== validator) changedSource()
        const range = parseContentRange(response.headers.get('content-range'))
        if (range && range.total !== size) changedSource()
        if (
          response.status !== 206 ||
          tag !== validator ||
          !usesFileBytes(response, credentials) ||
          !range ||
          range.start !== offset ||
          range.end !== offset + length - 1
        )
          fail('readFailed')
        const bytes = await readExact(response, length, combined)
        check(signal)
        return bytes
      } finally {
        await cancelBody(response)
      }
    })
    pending.add(task)
    task.then(
      () => pending.delete(task),
      () => pending.delete(task)
    )
    return task
  }
  const dispose = () => {
    if (closing) return closing
    closed = true
    life.abort()
    closing = (async () => {
      await Promise.allSettled([...pending])
      prefix = null
      if (file) await file.dispose()
    })()
    return closing
  }
  return { mode, size, metadata, read, dispose }
}

export async function run(otherOrigin) {
  globalThis.urlProofStage = 'storage'
  const storage = await temporaryStorage()
  const results = []
  const freshSignal = () => new AbortController().signal
  const expected = (offset, length, delta = 0) =>
    Array.from({ length }, (_, i) => (offset + i + delta) % 256)
  const assertBytes = (bytes, wanted) =>
    assert(
      JSON.stringify(Array.from(bytes)) === JSON.stringify(wanted),
      'The source returned different file bytes.'
    )
  const expectFailure = async (operation, code) => {
    try {
      await operation
    } catch (error) {
      assert(
        error instanceof SourceFailure && error.code === code,
        'Unexpected source failure category.'
      )
      return
    }
    throw new Error('A source operation unexpectedly succeeded.')
  }
  const scenarios = [
    ['stable', 'range', location.origin],
    ['ignored', 'snapshot', location.origin],
    ['weak', 'snapshot', location.origin],
    ['cors-hidden', 'snapshot', otherOrigin],
    ['cors-list', 'snapshot', otherOrigin],
    ['cors-visible', 'range', otherOrigin],
    ['cors-self-list', 'range', otherOrigin],
    ['cors-credentials', 'snapshot', otherOrigin]
  ]
  for (const [name, mode, origin] of scenarios) {
    globalThis.urlProofStage = name
    const credentials = ['cors-credentials', 'cors-self-list'].includes(name)
      ? 'include'
      : 'same-origin'
    const opening = new AbortController()
    const source = await openStableForProof(origin + '/file/' + name, storage, {
      credentials,
      signal: opening.signal
    })
    opening.abort()
    assert(source.mode === mode, 'The source chose a different input strategy.')
    const delta = name === 'weak' ? 20 : 0
    assertBytes(await source.read(0, 8, freshSignal()), expected(0, 8, delta))
    assertBytes(await source.read(40, 12, freshSignal()), expected(40, 12, delta))
    const copy = await source.read(0, 1, freshSignal())
    copy[0] ^= 255
    assertBytes(await source.read(0, 1, freshSignal()), expected(0, 1, delta))
    await expectFailure(source.read(95, 2, freshSignal()), 'invalidInput')
    await source.dispose()
    await source.dispose()
    await expectFailure(source.read(0, 1, freshSignal()), 'closed')
    results.push({
      name,
      mode: source.mode,
      size: source.size,
      metadata: source.metadata,
      openSignalLifetimePassed: true,
      isolatedReadBufferPassed: true
    })
  }
  globalThis.urlProofStage = 'gzip'
  const gzip = await openStableForProof(location.origin + '/file/gzip', storage)
  assert(
    gzip.mode === 'snapshot' &&
      gzip.size === 128 &&
      Number(gzip.metadata.contentLength) !== gzip.size,
    'Encoded transfer size was treated as file size.'
  )
  assertBytes(await gzip.read(60, 8, freshSignal()), Array(8).fill(65))
  await gzip.dispose()
  results.push({
    name: 'gzip',
    mode: gzip.mode,
    fileBytes: gzip.size,
    httpContentLength: Number(gzip.metadata.contentLength),
    probeTransportFailed: gzip.metadata.probeTransportFailed
  })
  for (const name of ['changed', 'redirect']) {
    globalThis.urlProofStage = name
    const source = await openStableForProof(location.origin + '/file/' + name, storage)
    await expectFailure(source.read(40, 12, freshSignal()), 'sourceChanged')
    await expectFailure(source.read(0, 1, freshSignal()), 'sourceChanged')
    await source.dispose()
    results.push({ name, failed: 'sourceChanged', newRepresentationNotAdopted: true })
  }
  for (const name of ['wrong-range', 'short-body', 'missing-etag', 'ignored-later']) {
    globalThis.urlProofStage = name
    const source = await openStableForProof(location.origin + '/file/' + name, storage)
    await expectFailure(source.read(40, 12, freshSignal()), 'readFailed')
    assertBytes(await source.read(0, 4, freshSignal()), expected(0, 4))
    await source.dispose()
    results.push({ name, failed: 'readFailed', notMisclassifiedAsSourceChanged: true })
  }
  globalThis.urlProofStage = 'snapshot-budget'
  await expectFailure(
    openStableForProof(location.origin + '/file/gzip-limit', storage, { snapshotLimit: 512 }),
    'resourceLimit'
  )
  results.push({
    name: 'decoded-snapshot-budget',
    failed: 'resourceLimit',
    partialSourceNotPublished: true
  })
  const cancelOpen = new AbortController()
  globalThis.urlProofStage = 'cancel-snapshot'
  let wroteBeforeCancellation = false
  await expectFailure(
    openStableForProof(location.origin + '/file/slow', storage, {
      signal: cancelOpen.signal,
      onSnapshotWrite() {
        wroteBeforeCancellation = true
        cancelOpen.abort()
      }
    }),
    'cancelled'
  )
  assert(wroteBeforeCancellation, 'The snapshot did not write before cancellation.')
  results.push({ name: 'cancel-snapshot', wroteBeforeCancellation, failed: 'cancelled' })
  for (const name of ['cancel-range', 'dispose-range']) {
    globalThis.urlProofStage = name
    const source = await openStableForProof(location.origin + '/file/' + name, storage)
    const controller = new AbortController()
    const pending = source.read(40, 12, controller.signal)
    const rejected = expectFailure(pending, name === 'cancel-range' ? 'cancelled' : 'closed')
    await fetch(location.origin + '/waiting/' + name)
    if (name === 'cancel-range') controller.abort()
    else await source.dispose()
    await rejected
    if (name === 'cancel-range')
      assertBytes(await source.read(32, 8, freshSignal()), expected(32, 8))
    await source.dispose()
    results.push({
      name,
      failed: name === 'cancel-range' ? 'cancelled' : 'closed',
      pendingReadSettled: true
    })
  }
  const stats = storage.stats()
  assert(
    stats.created === stats.removed && stats.live === 0,
    'The URL probe left temporary files allocated.'
  )
  return { results, storage: stats, opfsUsed: true, nodeInRenderer: typeof process !== 'undefined' }
}
