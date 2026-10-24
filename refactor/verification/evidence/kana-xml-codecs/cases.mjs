// Compare exact named encodings and pass streamed UTF-8 into the existing XML syntax owner.
import { createConverter, CodecFailure } from './convert.mjs'
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
const parts = function* (bytes, chunk) {
  for (let offset = 0; offset < bytes.length; offset += chunk)
    yield bytes.subarray(offset, offset + chunk)
}
const fromBase64 = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
const points = (value) =>
  [...value].map(
    (character) => 'U+' + character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')
  )

export async function runCodecCases(
  codecFactory,
  xmlFactory,
  fixtureData,
  expectedMismatches = new Set()
) {
  const codec = await codecFactory()
  const convert = createConverter(codec)
  let root = null
  let stack = []
  const xml = await xmlFactory({
    catalogIds: new Set(),
    catalogBytes: new Uint8Array(),
    singleByteMaps: {},
    sourceEvent(kind, value, attributes) {
      if (kind === 'start') {
        const names = value.split('\x1f')
        const node = {
          name: names.at(-1),
          namespace: names.length === 2 ? names[0] : '',
          attributes: attributes.sort(([a], [b]) => (a === b ? 0 : a < b ? -1 : 1)),
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
  const xmlBuffer = xml._malloc(4096)
  const records = []
  try {
    for (const fixture of fixtureData.cases) {
      const bytes = fromBase64(fixture.bytes)
      const attempts = []
      for (const chunk of fixture.chunks ?? [1, 2, 7, 4096]) {
        for (const outputCapacity of [16, 257]) {
          root = null
          stack = []
          assert(
            xml._kana_xml_open(128, 100000, 2 * 1024 * 1024, 1024 * 1024, 8 * 1024 * 1024),
            'XML parser creation failed.'
          )
          try {
            const observation = await convert(
              parts(bytes, chunk),
              fixture.codec,
              (output) => {
                xml.HEAPU8.set(output, xmlBuffer)
                assert(
                  xml._kana_xml_feed(xmlBuffer, output.length, 0),
                  'The transcoded XML was rejected: ' + fixture.name
                )
              },
              { outputCapacity }
            )
            assert(xml._kana_xml_feed(xmlBuffer, 0, 1), 'The transcoded XML did not finish.')
            const treeMatched = JSON.stringify(root) === JSON.stringify(fixture.expectedTree)
            assert(
              treeMatched !== expectedMismatches.has(fixture.name),
              'The source tree result changed: ' + fixture.name
            )
            attempts.push({ chunk, ...observation, treeMatched })
          } finally {
            xml._kana_xml_close()
            root = null
            stack = []
          }
          assert(codec._kana_codec_active() === 0, 'A decoder survived a completed document.')
        }
      }
      records.push({
        name: fixture.name,
        originalBytesLibxml2Matched: fixture.libxml2OriginalBytesMatch,
        attempts
      })
    }
  } finally {
    xml._free(xmlBuffer)
  }

  const invalid = [
    ['invalid-utf8', 'UTF-8', [0xc3, 0x28]],
    ['unfinished-utf16', 'UTF-16LE', [0x00, 0xd8]],
    ['surrogate-utf32', 'UTF-32LE', [0x00, 0xd8, 0x00, 0x00]],
    ['unfinished-gb18030', 'GB18030', [0x94, 0x39, 0xfc]],
    ['invalid-shift-jis', 'Shift_JIS', [0x82, 0x20]],
    ['unfinished-state-escape', 'ISO-2022-JP', [0x1b, 0x24]],
    ['not-gb2312', 'GB2312', [0x81, 0x40]]
  ]
  const failures = []
  async function reject(name, operation, reason) {
    let actual
    try {
      await operation()
    } catch (error) {
      if (!(error instanceof CodecFailure)) throw error
      actual = error.reason
    }
    assert(actual === reason, 'The expected encoding failure did not occur: ' + name)
    assert(codec._kana_codec_active() === 0, 'A failed decoder was retained.')
    failures.push({ name, reason, decoderReleased: true })
  }
  for (const [name, encoding, bytes] of invalid)
    await reject(
      name,
      () => convert(parts(Uint8Array.from(bytes), 1), encoding, () => {}),
      'invalidEncoding'
    )
  for (const label of ['', 'unknown-codec', 'UTF-8//IGNORE', 'UTF-8//TRANSLIT'])
    await reject('unsupported-' + label, () => convert([], label, () => {}), 'unsupportedEncoding')
  await reject(
    'decoded-output-budget',
    () =>
      convert(parts(new TextEncoder().encode('A'.repeat(256)), 17), 'UTF-8', () => {}, {
        maxOutput: 64
      }),
    'resourceLimit'
  )
  const aborter = new AbortController()
  await reject(
    'cancel-between-output-chunks',
    () =>
      convert(
        parts(new TextEncoder().encode('A'.repeat(256)), 17),
        'UTF-8',
        () => aborter.abort(),
        { signal: aborter.signal }
      ),
    'cancelled'
  )

  const comparisons = []
  for (const [encoding, bytes] of [
    ['ISO-8859-1', [0x80]],
    ['ISO-8859-9', [0x80]],
    ['Shift_JIS', [0x81, 0x60]],
    ['CP932', [0x81, 0x60]],
    ['GB2312', [0x81, 0x40]],
    ['Big5', [0x88, 0x62]],
    ['UTF-32LE', [0x00, 0xf6, 0x01, 0x00]]
  ]) {
    let converted = ''
    let strict
    try {
      await convert([Uint8Array.from(bytes)], encoding, (part) => {
        converted += new TextDecoder().decode(part)
      })
      strict = { codePoints: points(converted) }
    } catch (error) {
      if (!(error instanceof CodecFailure)) throw error
      strict = { reason: error.reason }
    }
    let native
    try {
      const decoder = new TextDecoder(encoding, { fatal: true })
      native = {
        canonical: decoder.encoding,
        codePoints: points(decoder.decode(Uint8Array.from(bytes)))
      }
    } catch (error) {
      native = { rejected: true, errorType: error.name }
    }
    comparisons.push({ encoding, bytes, strict, native })
  }
  assert(codec._kana_codec_active() === 0, 'A comparison decoder was retained.')
  let mappingMismatches = 0
  for (const [code, expected] of fixtureData.cp932) {
    let output = ''
    const bytes = code < 256 ? [code] : [code >> 8, code & 255]
    await convert([Uint8Array.from(bytes)], 'CP932', (part) => {
      output += new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(part)
    })
    if (output !== String.fromCodePoint(expected)) mappingMismatches++
  }
  assert(
    mappingMismatches === (expectedMismatches.has('CP932') ? 6 : 0),
    'The CP932 table result changed.'
  )
  return {
    cases: records,
    failures,
    comparisons,
    activeDecoders: codec._kana_codec_active(),
    cp932: { checkedMappings: fixtureData.cp932.length, mismatches: mappingMismatches },
    wasmMemoryBytes: codec.HEAPU8.byteLength,
    limits: {
      fullXmlEncodingDetection: false,
      bomDeclarationConflicts: false,
      allLibiconvEncodings: false,
      fullReader: false,
      sourceOffsetsReinterpreted: false
    }
  }
}
