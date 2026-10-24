// Interpret captured source bytes before the decoder's extraction-oriented filename repairs.
function validateLegacyUnicode(bytes, decodedLength) {
  const ansiLength = bytes.indexOf(0)
  let cursor = ansiLength + 2,
    produced = 0
  if (ansiLength < 0 || cursor >= bytes.length) return false
  while (cursor < bytes.length) {
    const flags = bytes[cursor++]
    for (let shift = 6; shift >= 0; shift -= 2) {
      const kind = (flags >> shift) & 3
      if (cursor >= bytes.length) return false
      if (kind === 0 || kind === 1) {
        cursor++
        produced++
      } else if (kind === 2) {
        if (cursor + 2 > bytes.length) return false
        cursor += 2
        produced++
      } else {
        const length = bytes[cursor++]
        if (length & 0x80) {
          if (cursor >= bytes.length) return false
          cursor++
        }
        const count = (length & 0x7f) + 2
        if (produced + count > ansiLength) return false
        produced += count
      }
      if (cursor === bytes.length) break
    }
  }
  return produced === decodedLength
}
export function admitName(raw, legacyEncoding, oemMaps = {}) {
  if (raw.bytes.length !== raw.declared) return { failure: 'nameTruncated' }
  const bytes = Uint8Array.from(raw.bytes)
  let name
  try {
    if (raw.format === 5 || (raw.flags & 0x200 && !bytes.includes(0)))
      name = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
    else if (raw.format === 3 && raw.flags & 0x200) {
      const units = raw.decodedUnits
      if (
        !units ||
        !validateLegacyUnicode(bytes, units.length) ||
        units.some((unit) => unit > 0xffff)
      )
        return { failure: 'invalidEncoding' }
      name = String.fromCharCode(...units)
      if (!name.isWellFormed()) return { failure: 'invalidEncoding' }
    } else if (legacyEncoding && oemMaps[legacyEncoding]) {
      const points = Array.from(bytes, (byte) => oemMaps[legacyEncoding][byte])
      if (points.some((point) => point < 0)) return { failure: 'invalidEncoding' }
      name = points.map((point) => String.fromCodePoint(point)).join('')
    } else if (legacyEncoding)
      name = new TextDecoder(legacyEncoding, { fatal: true, ignoreBOM: true }).decode(bytes)
    else if (bytes.every((byte) => byte < 128)) name = new TextDecoder('utf-8').decode(bytes)
    else return { failure: 'legacyEncodingRequired' }
  } catch {
    return { failure: 'invalidEncoding' }
  }
  if (!name || name.includes('\0')) return { failure: 'invalidName' }
  if (raw.format === 5 && raw.host === 0 && name.includes('\\')) return { failure: 'invalidName' }
  if (raw.format === 3) name = name.replaceAll('\\', '/')
  if (name.startsWith('/') || /^[A-Za-z]:/.test(name)) return { failure: 'outsideArchive' }
  const parts = []
  for (const part of name.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (!parts.length) return { failure: 'outsideArchive' }
      parts.pop()
    } else parts.push(part)
  }
  if (!parts.length) return { failure: 'invalidName' }
  return { name: parts.join('/') }
}

export async function readNames(factory, bytes, password = '') {
  const module = await factory({
    print: () => {},
    printErr: () => {},
    hostRead: async (name, offset, length) =>
      bytes.subarray(offset, Math.min(bytes.length, offset + Math.min(length, 65536))),
    hasVolume: (name) => name === '/source/book.rar',
    hostOutput: async () => {}
  })
  if (!module._kana_set_utf8_locale()) throw new Error('UTF-8 locale is unavailable')
  module.FS.mkdir('/source')
  module.FS.createDataFile('/source', 'book.rar', new Uint8Array(), true, false)
  module.FS.lookupPath('/source/book.rar').node.usedBytes = bytes.length
  const call = (name, types = [], values = []) =>
    module.ccall(name, 'number', types, values, { async: true })
  const requireSuccess = (status) => {
    if (status) throw Object.assign(new Error('Native name probe failed'), { status })
  }
  const names = []
  requireSuccess(
    await call('kana_open', ['string', 'string', 'number'], ['/source/book.rar', password, 0])
  )
  try {
    for (let count = 0; count < 100; count++) {
      const status = await call('kana_next')
      if (status === 10) return names
      requireSuccess(status)
      if (!module.rawName) throw new Error('Source name hook was not called')
      names.push({
        original: module.rawName,
        dllName: module.UTF8ToString(module._kana_name()),
        admitted: admitName(module.rawName)
      })
      requireSuccess(await call('kana_process', ['number'], [1]))
    }
    throw new Error('Name probe member limit exceeded')
  } finally {
    requireSuccess(await call('kana_close'))
    module.FS.unlink('/source/book.rar')
    module.FS.rmdir('/source')
  }
}
