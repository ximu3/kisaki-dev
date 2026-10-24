// Keep the upstream module configuration and decode pool inside one owned realm.
import {
  configure,
  Reader,
  ZipReader,
  Uint8ArrayWriter,
  terminateWorkers
} from '/vendor/zip/lib/zip-fs-external.js'

configure({
  useWebWorkers: false,
  useCompressionStream: false,
  wasmURI: new URL('zip-module.wasm', self.location.href).href
})

let nextRead = 0
const pendingReads = new Map()
class RangeReader extends Reader {
  constructor(size) {
    super()
    this.size = size
  }
  readUint8Array(offset, length) {
    return new Promise((resolve) => {
      const id = ++nextRead
      pendingReads.set(id, resolve)
      postMessage({ type: 'read', id, offset, length })
    })
  }
}

let archive
let entries
self.onmessage = async ({ data }) => {
  if (data.type === 'bytes') {
    pendingReads.get(data.id)(data.bytes)
    pendingReads.delete(data.id)
    return
  }
  try {
    if (data.type === 'open') {
      archive = new ZipReader(new RangeReader(data.size))
      entries = await archive.getEntries()
      postMessage({ type: 'opened', names: entries.map((entry) => entry.filename) })
    } else if (data.type === 'extract') {
      const bytes = await entries[0].getData(new Uint8ArrayWriter(), { checkSignature: true })
      postMessage({ type: 'extracted', text: new TextDecoder().decode(bytes) })
    } else if (data.type === 'close') {
      await archive.close()
      await terminateWorkers()
      postMessage({ type: 'closed', pendingReads: pendingReads.size })
      self.close()
    }
  } catch (error) {
    postMessage({ type: 'failed', name: error.name, message: error.message })
  }
}
