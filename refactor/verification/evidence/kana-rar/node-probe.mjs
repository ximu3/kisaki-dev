// Exercise Asyncify reads and bounded output callbacks before adding the browser transport.
import { open, stat, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const [cache, fixture, output] = process.argv.slice(2)
const factory = (await import(pathToFileURL(join(cache, 'build/unrar.mjs')).href)).default
const file = await open(join(cache, 'fixtures', fixture), 'r')
const size = (await stat(join(cache, 'fixtures', fixture))).size
let readCalls = 0,
  readBytes = 0,
  maxRead = 0,
  outputBytes = 0,
  maxOutput = 0
let hash,
  checksum = 0xffffffff
const table = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})
const module = await factory({
  print: () => {},
  printErr: (message) => process.stderr.write(message + '\n'),
  hasVolume: (path) => path === '/source/book.rar',
  hostRead: async (path, position, length) => {
    if (path !== '/source/book.rar') throw new Error('Unexpected source path')
    const count = Math.max(0, Math.min(length, size - position, 65536))
    if (!count) return new Uint8Array()
    const chunk = new Uint8Array(count)
    const result = await file.read(chunk, 0, count, position)
    if (result.bytesRead !== count) throw new Error('Fixture range read was incomplete')
    readCalls++
    readBytes += count
    maxRead = Math.max(maxRead, count)
    return chunk
  },
  hostOutput: async (chunk) => {
    await Promise.resolve()
    maxOutput = Math.max(maxOutput, chunk.length)
    outputBytes += chunk.length
    hash.update(chunk)
    for (const byte of chunk) checksum = table[(checksum ^ byte) & 255] ^ (checksum >>> 8)
  }
})
module.FS.mkdir('/source')
module.FS.createDataFile('/source', 'book.rar', new Uint8Array(), true, false)
const node = module.FS.lookupPath('/source/book.rar').node
node.usedBytes = size
const call = (name, types = [], values = []) =>
  module.ccall(name, 'number', types, values, { async: true })
const entries = []
try {
  const opened = await call(
    'kana_open',
    ['string', 'string', 'number'],
    ['/source/book.rar', '', 0]
  )
  if (opened) throw new Error(`Opening fixture failed with code ${opened}`)
  for (let count = 0; count < 100; count++) {
    const status = await call('kana_next')
    if (status === 10) break
    if (status) throw new Error(`Reading fixture header failed with code ${status}`)
    const name = module.UTF8ToString(module._kana_name())
    const expectedSize = module._kana_unpacked_size()
    const expectedCrc = module._kana_crc() >>> 0
    const flags = module._kana_flags()
    const hashType = module._kana_hash_type()
    const before = outputBytes
    hash = createHash('sha256')
    checksum = 0xffffffff
    const processed = await call('kana_process', ['number'], [0])
    if (processed) throw new Error(`Decoding fixture member failed with code ${processed}`)
    const crc = (checksum ^ 0xffffffff) >>> 0
    if (outputBytes - before !== expectedSize)
      throw new Error('Decoded member size differs from header')
    if (hashType === 1 && crc !== expectedCrc)
      throw new Error('Independent output checksum differs from header')
    entries.push({ name, expectedSize, flags, hashType, crc, sha256: hash.digest('hex') })
  }
  const closed = await call('kana_close')
  if (closed) throw new Error(`Closing fixture failed with code ${closed}`)
  const result = {
    fixture,
    size,
    entries,
    readCalls,
    readBytes,
    maxRead,
    outputBytes,
    maxOutput,
    maxNativeOutput: module.maxNativeOutput,
    heapBytes: module._kana_heap_bytes(),
    asyncReadsExecuted: true,
    browserExecuted: false
  }
  await writeFile(output, JSON.stringify(result, null, 2) + '\n')
  process.stdout.write(
    JSON.stringify({
      fixture,
      entries: entries.length,
      readCalls,
      maxRead,
      outputBytes,
      maxOutput
    }) + '\n'
  )
} finally {
  await file.close()
}
