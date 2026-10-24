// Exercise reference metadata and bounded payload reads through the real native decoder.
export async function openArchive(factory, source) {
  let output = async () => {}
  let maxNativeOutput = 0
  const module = await factory({
    print: () => {},
    printErr: () => {},
    hostRead: async (path, offset, length) => {
      if (path !== '/source/book.rar') throw new Error('Unknown source')
      return source.read(offset, Math.min(length, Math.max(0, source.size - offset)))
    },
    hasVolume: (path) => path === '/source/book.rar',
    hostOutput: (chunk) => output(chunk)
  })
  if (!module._kana_set_utf8_locale()) throw new Error('UTF-8 runtime locale is unavailable')
  const baselineStreams = module.FS.streams.filter(Boolean).length
  const call = (name, types = [], values = []) =>
    module.ccall(name, 'number', types, values, { async: true })
  const requireSuccess = (status) => {
    if (status) throw Object.assign(new Error('Native archive operation failed'), { code: status })
  }
  module.FS.mkdir('/source')
  module.FS.createDataFile('/source', 'book.rar', new Uint8Array(), true, false)
  module.FS.lookupPath('/source/book.rar').node.usedBytes = source.size
  const start = async () =>
    requireSuccess(
      await call('kana_open', ['string', 'string', 'number'], ['/source/book.rar', '', 0])
    )
  const close = async () => {
    requireSuccess(await call('kana_close'))
    if (module.FS.streams.filter(Boolean).length !== baselineStreams)
      throw new Error('Native file remained open')
    maxNativeOutput = Math.max(maxNativeOutput, module.maxNativeOutput || 0)
  }
  const metadata = () => {
    const pointer = module._kana_reference_target()
    if (!pointer) throw new Error('Reference target exceeds the probe budget')
    return {
      name: module.UTF8ToString(module._kana_name()),
      size: module._kana_unpacked_size(),
      redirection: module._kana_redirection(),
      target: module.UTF8ToString(pointer),
      directory: !!(module._kana_flags() & 32),
      directoryTarget: !!module._kana_reference_directory(),
      windowsNames: !!module._kana_windows_names(),
      targetInData: !!module._kana_reference_in_data()
    }
  }
  return {
    async list() {
      const entries = []
      await start()
      try {
        for (let index = 0; index < 100; index++) {
          const status = await call('kana_next')
          if (status === 10) return entries
          requireSuccess(status)
          const entry = { ...metadata(), index }
          if (entry.targetInData) {
            let size = 0
            const chunks = []
            output = async (chunk) => {
              size += chunk.length
              if (size >= 65536) throw new Error('Reference target exceeds the probe budget')
              chunks.push(chunk)
            }
            requireSuccess(await call('kana_process_reference'))
            const bytes = new Uint8Array(size)
            let offset = 0
            for (const chunk of chunks) {
              bytes.set(chunk, offset)
              offset += chunk.length
            }
            entry.target = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
            if (entry.target.includes('\0'))
              throw new Error('Reference target contains a null character')
          } else requireSuccess(await call('kana_process', ['number'], [1]))
          entries.push(entry)
        }
        throw new Error('Archive member count exceeds the probe budget')
      } finally {
        output = async () => {}
        await close()
      }
    },
    async read(entry, consume) {
      if (entry.redirection || entry.directory)
        throw new Error('Payload reads require a regular member')
      await start()
      try {
        for (let index = 0; index <= entry.index; index++) {
          requireSuccess(await call('kana_next'))
          if (index === entry.index) {
            const found = metadata()
            if (found.name !== entry.name || found.redirection || found.size !== entry.size)
              throw new Error('Indexed member changed')
            output = consume
            requireSuccess(await call('kana_process', ['number'], [0]))
          } else requireSuccess(await call('kana_process', ['number'], [1]))
        }
      } finally {
        output = async () => {}
        await close()
      }
    },
    async dispose() {
      await close()
      module.FS.unlink('/source/book.rar')
      module.FS.rmdir('/source')
      return { openStreams: baselineStreams, maxNativeOutput, heapBytes: module._kana_heap_bytes() }
    }
  }
}
