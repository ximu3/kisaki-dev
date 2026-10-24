// Own one decoder instance and at most one acknowledged source/output transfer at a time.
import createUnrar from '/build/unrar.mjs'

const pending = new Map()
let sequence = 0
let cancelled = false
let started = false
let maximumPending = 0
const request = (kind, data, transfer = []) => {
  if (cancelled) return Promise.reject(new Error('Decoder cancelled'))
  const id = ++sequence
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    maximumPending = Math.max(maximumPending, pending.size)
    postMessage({ kind, id, ...data }, transfer)
  })
}

onmessage = ({ data }) => {
  if (data.kind === 'reply') {
    const reply = pending.get(data.id)
    if (!reply) return
    pending.delete(data.id)
    if (data.failed) reply.reject(new Error('Host operation failed'))
    else reply.resolve(data.buffer ? new Uint8Array(data.buffer) : undefined)
  } else if (data.kind === 'cancel') {
    cancelled = true
    for (const entry of pending.values()) entry.reject(new Error('Decoder cancelled'))
    pending.clear()
  } else if (data.kind === 'start' && !started) {
    started = true
    run(data).catch(() => postMessage({ kind: 'fatal', reason: 'Decoder runtime failed' }))
  }
}

async function run(config) {
  const entries = []
  let activeEntry = -1
  let failure = null
  let reachedEnd = false
  let maximumHeapBytes = 0
  const factory = config.limitedHeap ? (await import('/limited/unrar.mjs')).default : createUnrar
  const module = await factory({
    print: () => {},
    printErr: () => {},
    hasVolume: (path) => config.sources.some((source) => path === '/source/' + source.name),
    hostRead: (path, offset, length) => request('read', { path, offset, length }),
    hostOutput: (chunk) =>
      request('output', { entry: activeEntry, buffer: chunk.buffer }, [chunk.buffer])
  })
  const openStreamsBefore = module.FS.streams.filter(Boolean).length
  const call = async (name, types = [], values = []) => {
    const result = await module.ccall(name, 'number', types, values, { async: true })
    maximumHeapBytes = Math.max(maximumHeapBytes, module._kana_heap_bytes())
    return result
  }
  module.FS.mkdir('/source')
  for (const source of config.sources) {
    module.FS.createDataFile('/source', source.name, new Uint8Array(), true, false)
    // This prototype uses MEMFS only for file metadata; fd_read owns all byte access.
    module.FS.lookupPath('/source/' + source.name).node.usedBytes = source.size
  }
  try {
    const opened = await call(
      'kana_open',
      ['string', 'string', 'number'],
      ['/source/' + config.sources[0].name, config.password || '', 0]
    )
    config.password = ''
    if (opened) failure = { stage: 'open', code: opened }
    for (let index = 0; !failure && index < 100; index++) {
      const status = await call('kana_next')
      if (status === 10) {
        reachedEnd = true
        break
      }
      if (status) {
        failure = { stage: 'header', code: status }
        break
      }
      const entry = {
        name: module.UTF8ToString(module._kana_name()),
        size: module._kana_unpacked_size(),
        flags: module._kana_flags(),
        redirection: module._kana_redirection(),
        hashType: module._kana_hash_type(),
        crc: module._kana_crc() >>> 0,
        dictionaryKiB: module._kana_dictionary(),
        skipped: config.selectedIndex !== undefined && index !== config.selectedIndex
      }
      entries.push(entry)
      activeEntry = index
      postMessage({ kind: 'entry', index, entry })
      if (entry.redirection !== 0) {
        failure = { stage: 'member', reason: 'redirectedMemberRequiresPolicy' }
        break
      }
      postMessage({ kind: 'phase', phase: 'process', index })
      const processed = await call('kana_process', ['number'], [entry.skipped ? 1 : 0])
      if (processed) failure = { stage: 'member', code: processed }
    }
    if (!failure && !reachedEnd) failure = { stage: 'header', reason: 'memberCountLimit' }
  } finally {
    const closed = await call('kana_close')
    const afterClose = await call('kana_next')
    const openStreamsAfter = module.FS.streams.filter(Boolean).length
    for (const source of config.sources) module.FS.unlink('/source/' + source.name)
    module.FS.rmdir('/source')
    postMessage({
      kind: 'done',
      entries,
      failure,
      cancelled,
      inputFailed: !!module.inputFailed,
      outputFailed: !!module.outputFailed,
      maxNativeOutput: module.maxNativeOutput || 0,
      maximumHeapBytes,
      maximumPending,
      pending: pending.size,
      closed,
      afterClose,
      sourceNodesRemoved: true,
      openStreamsBefore,
      openStreamsAfter
    })
  }
}
