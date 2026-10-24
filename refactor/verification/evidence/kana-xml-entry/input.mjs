// Resolve file-local XML encoding once, then stream into the same bounded syntax owner.
import { createConverter, CodecFailure } from '../kana-xml-codecs/convert.mjs'

export class EntryFailure extends Error {
  constructor(code, reason, cause) {
    super('The XML input could not be read.', { cause })
    this.code = code
    this.reason = reason
  }
}
const fail = (code, reason, cause) => {
  throw new EntryFailure(code, reason, cause)
}
const checkAbort = (signal) => {
  if (signal?.aborted) fail('cancelled', 'cancelled')
}
const ascii = new TextEncoder()
const unicodeShape = (name) => {
  if (name === 'UTF-8') return { width: 1, endian: null }
  const match = /^(UTF-(16|32)|UCS-([24]))(BE|LE)?$/.exec(name)
  return match
    ? {
        width: match[2] ? Number(match[2]) / 8 : Number(match[3]),
        endian: match[4] ?? null,
        family: match[1]
      }
    : null
}

class InputCursor {
  constructor(source, options) {
    this.iterator = source[Symbol.asyncIterator]?.() ?? source[Symbol.iterator]()
    this.signal = options.signal
    this.sourceLimit = options.sourceLimit ?? 64 * 1024 * 1024
    this.prefix = new Uint8Array(options.declarationLimit ?? 65536)
    this.used = 0
    this.bytes = 0
    this.part = new Uint8Array()
    this.offset = 0
    this.done = false
  }
  async nextPart() {
    checkAbort(this.signal)
    let next
    try {
      next = await this.iterator.next()
    } catch (cause) {
      if (this.signal?.aborted) fail('cancelled', 'cancelled', cause)
      if (cause instanceof EntryFailure) throw cause
      fail('readFailed', 'sourceRead', cause)
    }
    checkAbort(this.signal)
    if (next.done) {
      this.done = true
      return false
    }
    if (!(next.value instanceof Uint8Array)) fail('readFailed', 'sourceShape')
    this.bytes += next.value.length
    if (this.bytes > this.sourceLimit) fail('resourceLimit', 'source')
    this.part = next.value
    this.offset = 0
    return true
  }
  async ensure(length) {
    if (length > this.prefix.length) fail('resourceLimit', 'declaration')
    while (this.used < length) {
      if (this.offset === this.part.length) {
        if (this.done || !(await this.nextPart())) return false
        if (!this.part.length) continue
      }
      const count = Math.min(length - this.used, this.part.length - this.offset)
      this.prefix.set(this.part.subarray(this.offset, this.offset + count), this.used)
      this.used += count
      this.offset += count
    }
    return true
  }
  async *remaining(skip) {
    if (this.used > skip) yield this.prefix.slice(skip, this.used)
    if (this.offset < this.part.length) yield this.part.subarray(this.offset)
    while (!this.done && (await this.nextPart())) if (this.part.length) yield this.part
  }
  async close() {
    try {
      if (this.iterator.return) await this.iterator.return()
    } catch (cause) {
      fail('readFailed', 'sourceClose', cause)
    }
  }
}

function signature(bytes) {
  const starts = (...value) => value.every((byte, index) => bytes[index] === byte)
  if (
    starts(0, 0, 255, 254) ||
    starts(254, 255, 0, 0) ||
    starts(0, 0, 60, 0) ||
    starts(0, 60, 0, 0)
  )
    fail('unsupportedFeature', 'unsupportedByteOrder')
  if (starts(0, 0, 254, 255)) return { width: 4, endian: 'BE', bom: 4 }
  if (starts(255, 254, 0, 0)) return { width: 4, endian: 'LE', bom: 4 }
  if (starts(239, 187, 191)) return { width: 1, endian: null, bom: 3 }
  if (starts(254, 255)) return { width: 2, endian: 'BE', bom: 2 }
  if (starts(255, 254)) return { width: 2, endian: 'LE', bom: 2 }
  if (starts(0, 0, 0, 60)) return { width: 4, endian: 'BE', bom: 0 }
  if (starts(60, 0, 0, 0)) return { width: 4, endian: 'LE', bom: 0 }
  if (starts(0, 60, 0, 63)) return { width: 2, endian: 'BE', bom: 0 }
  if (starts(60, 0, 63, 0)) return { width: 2, endian: 'LE', bom: 0 }
  if (starts(76, 111, 167, 148)) fail('unsupportedFeature', 'unsupportedEbcdic')
  return { width: 1, endian: null, bom: 0 }
}

async function declaration(cursor, sig, parseDeclaration) {
  async function character(index) {
    const begin = sig.bom + index * sig.width
    if (!(await cursor.ensure(begin + sig.width))) return null
    let value = 0
    for (let step = 0; step < sig.width; step++) {
      const offset = sig.endian === 'LE' ? sig.width - step - 1 : step
      value = value * 256 + cursor.prefix[begin + offset]
    }
    return value <= 127 ? String.fromCharCode(value) : '\uffff'
  }
  let prefix = ''
  for (let index = 0; index < 6; index++) {
    const next = await character(index)
    if (next === null) break
    prefix += next
  }
  if (!prefix.startsWith('<?xml') || (prefix.length > 5 && !/[\t\n\r ?]/.test(prefix[5])))
    return { version: '1.0', encoding: null, standalone: -1, present: false }
  for (let index = prefix.length; !prefix.endsWith('?>'); index++) {
    const next = await character(index)
    if (next === null || next === '\uffff') fail('invalidDocument', 'declarationSyntax')
    prefix += next
  }
  return { ...parseDeclaration(prefix), present: true }
}

function chooseEncoding(sig, decl, registry, format) {
  if (decl.version !== '1.0') fail('unsupportedFeature', 'xmlVersion')
  let canonical
  if (decl.encoding) {
    const label = decl.encoding.toLowerCase()
    if (!Object.hasOwn(registry.labels, label)) fail('unsupportedFeature', 'unknownEncoding')
    canonical = registry.labels[label]
  } else {
    if (sig.width === 4 || (sig.width === 2 && !sig.bom))
      fail('invalidDocument', 'missingEncodingDeclaration')
    canonical = sig.width === 2 ? 'UTF-16' : 'UTF-8'
  }
  const shape = unicodeShape(canonical)
  if (shape) {
    if (shape.width !== sig.width) fail('invalidDocument', 'encodingConflict')
    if (shape.endian && shape.endian !== sig.endian) fail('invalidDocument', 'byteOrderConflict')
    if (canonical === 'UTF-16' && !sig.bom) fail('invalidDocument', 'missingUtf16Bom')
    if (!sig.bom && shape.width > 1 && !shape.endian && sig.endian !== 'BE')
      fail('invalidDocument', 'byteOrderConflict')
  } else if (sig.bom || sig.width !== 1) fail('invalidDocument', 'encodingConflict')
  if (format === 'epub' && !(canonical === 'UTF-8' || canonical.startsWith('UTF-16')))
    fail('invalidDocument', 'epubEncoding')
  // Explicit byte order preserves a consumed signature without relying on converter defaults.
  const effective = shape?.width > 1 && !shape.endian ? `${shape.family}${sig.endian}` : canonical
  const native =
    canonical === 'UTF-8' ||
    canonical === 'US-ASCII' ||
    canonical === 'ISO-8859-1' ||
    canonical.startsWith('UTF-16')
  return { canonical, effective, route: native ? 'native' : 'transcode' }
}

export async function createXmlEntry(xmlFactory, loadCodec, registry, catalog) {
  let root = null
  let stack = []
  let declared = null
  const xml = await xmlFactory({
    catalogIds: new Set(catalog.publicIds),
    catalogBytes: ascii.encode(catalog.dtd),
    singleByteMaps: {},
    xmlDeclaration(value) {
      declared = value
    },
    sourceEvent(kind, value, attributes) {
      if (kind === 'start') {
        const name = value.split('\x1f')
        const node = {
          name: name.at(-1),
          namespace: name.length === 2 ? name[0] : '',
          attributes: attributes.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
          children: []
        }
        if (stack.length) stack.at(-1).children.push(node)
        else root = node
        stack.push(node)
      } else if (kind === 'end') stack.pop()
      else if (value && stack.length) {
        const children = stack.at(-1).children
        if (typeof children.at(-1) === 'string') children[children.length - 1] += value
        else children.push(value)
      }
    }
  })
  function parseDeclaration(text) {
    const bytes = ascii.encode(text)
    const pointer = xml._malloc(bytes.length)
    if (!pointer) fail('resourceLimit', 'decoder')
    declared = null
    try {
      xml.HEAPU8.set(bytes, pointer)
      if (!xml._kana_entry_declaration(pointer, bytes.length))
        fail('invalidDocument', 'declarationSyntax')
      return declared
    } finally {
      xml._free(pointer)
    }
  }
  return {
    get activeParsers() {
      return xml._kana_entry_active()
    },
    async parse(source, options = {}) {
      checkAbort(options.signal)
      const cursor = new InputCursor(source, options)
      let buffer = 0
      let encodingPointer = 0
      let primaryFailure
      root = null
      stack = []
      try {
        await cursor.ensure(4)
        const sig = signature(cursor.prefix.subarray(0, cursor.used))
        const decl = await declaration(cursor, sig, parseDeclaration)
        const selected = chooseEncoding(sig, decl, registry, options.format ?? 'fb2')
        checkAbort(options.signal)
        const encoding = ascii.encode(
          (selected.route === 'native' ? selected.effective : 'UTF-8') + '\0'
        )
        encodingPointer = xml._malloc(encoding.length)
        buffer = xml._malloc(4096)
        if (!encodingPointer || !buffer) fail('resourceLimit', 'decoder')
        xml.HEAPU8.set(encoding, encodingPointer)
        if (
          !xml._kana_entry_open(
            encodingPointer,
            options.depth ?? 128,
            options.nodes ?? 100000,
            options.text ?? 4 * 1024 * 1024,
            options.metadata ?? 1024 * 1024,
            8 * 1024 * 1024
          )
        )
          fail('resourceLimit', 'decoder')
        let parserBytes = 0
        const feed = (bytes) => {
          checkAbort(options.signal)
          for (let offset = 0; offset < bytes.length; offset += 4096) {
            const part = bytes.subarray(offset, offset + 4096)
            parserBytes += part.length
            xml.HEAPU8.set(part, buffer)
            if (!xml._kana_xml_feed(buffer, part.length, 0))
              fail(xml._kana_xml_failure() === 1 ? 'resourceLimit' : 'invalidDocument', 'xmlSyntax')
          }
        }
        let conversion = null
        if (selected.route === 'native') {
          for await (const part of cursor.remaining(0)) feed(part)
        } else {
          let codec
          try {
            codec = await loadCodec()
          } catch (cause) {
            fail('assetUnavailable', 'codec', cause)
          }
          checkAbort(options.signal)
          try {
            conversion = await createConverter(codec)(
              cursor.remaining(sig.bom),
              selected.effective,
              feed,
              {
                signal: options.signal,
                inputCapacity: options.inputCapacity ?? 65552,
                maxOutput: options.decodedLimit ?? 64 * 1024 * 1024
              }
            )
          } catch (cause) {
            if (!(cause instanceof CodecFailure)) throw cause
            const code = {
              cancelled: 'cancelled',
              resourceLimit: 'resourceLimit',
              unsupportedEncoding: 'unsupportedFeature',
              invalidEncoding: 'invalidDocument'
            }[cause.reason]
            fail(code, cause.reason, cause)
          }
        }
        checkAbort(options.signal)
        if (!xml._kana_xml_feed(buffer, 0, 1))
          fail(xml._kana_xml_failure() === 1 ? 'resourceLimit' : 'invalidDocument', 'xmlSyntax')
        return {
          tree: root,
          declaration: decl,
          signature: sig,
          ...selected,
          conversion,
          sourceBytes: cursor.bytes,
          parserBytes,
          prefixBytes: cursor.used,
          catalogUses: xml._kana_xml_catalog_uses()
        }
      } catch (error) {
        primaryFailure = error
        throw error
      } finally {
        xml._kana_xml_close()
        if (encodingPointer) xml._free(encodingPointer)
        if (buffer) xml._free(buffer)
        root = null
        stack = []
        try {
          await cursor.close()
        } catch (cleanupFailure) {
          if (!primaryFailure) throw cleanupFailure
          const causes = new AggregateError(
            [primaryFailure, cleanupFailure],
            'XML input processing and cleanup failed.'
          )
          if (primaryFailure instanceof EntryFailure && primaryFailure.code === 'sourceChanged')
            fail('sourceChanged', 'sourceChangeAndCleanup', causes)
          fail('readFailed', 'sourceClose', causes)
        }
      }
    }
  }
}
