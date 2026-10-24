// Run independent format mechanisms in fresh browser workers, then terminate their resources.
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
const read = async (url) => {
  const response = await fetch(url)
  assert(response.ok, 'A fixed proof input is unavailable')
  return new Uint8Array(await response.arrayBuffer())
}
const json = async (url) => JSON.parse(new TextDecoder().decode(await read(url)))
const sha256 = async (bytes) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
onmessage = async ({ data: mode }) => {
  try {
    if (mode === 'xml') {
      const { default: factory } = await import('/xml-build/expat.mjs')
      const { runXmlCases } = await import('./xml-cases.mjs')
      const fixtures = await json('/source-fixtures.json')
      postMessage(
        await runXmlCases(
          factory,
          fixtures.cases,
          (name) => read('/source-fixtures/' + name),
          await json('/oem-maps.json')
        )
      )
    } else if (mode === 'names') {
      const { default: factory } = await import('/names-build/unrar.mjs')
      const { readNames, admitName } = await import('./names-parser.mjs')
      const fixtures = await json('/names-fixture-input.json')
      const runs = []
      for (const item of fixtures.cases) {
        const bytes = await read('/names/' + item.name)
        assert((await sha256(bytes)) === item.sha256, 'Name fixture changed')
        const names = await readNames(factory, bytes)
        assert(
          names.length === 1 &&
            names[0].admitted.name === (item.expected ?? undefined) &&
            names[0].admitted.failure === (item.reason ?? undefined),
          'Browser name admission differs'
        )
        runs.push({ name: item.name, names })
      }
      for (const name of [
        'test_read_format_rar_unicode.rar',
        'test_read_format_rar5_unicode.rar',
        'test_read_format_rar4_solid_encrypted_filenames.rar',
        'test_read_format_rar5_solid_encrypted_filenames.rar'
      ]) {
        const names = await readNames(
          factory,
          await read('/old-rar/' + name),
          name.includes('encrypted') ? 'password' : ''
        )
        for (const entry of names)
          if (entry.admitted.failure) {
            assert(
              name === 'test_read_format_rar_unicode.rar' &&
                entry.admitted.failure === 'legacyEncodingRequired',
              'Unexpected legacy name failure'
            )
            entry.explicitUtf8 = admitName(entry.original, 'utf-8')
            assert(
              entry.explicitUtf8.name === 'abcdefghijklmnopqrsテスト.txt',
              'Explicit legacy encoding differs'
            )
          }
        runs.push({ name, names })
      }
      const oemMaps = await json('/oem-maps.json')
      const legacyNames = await readNames(factory, await read('/names/legacy-cp437.rar'))
      const legacy = legacyNames.find((entry) => entry.original.bytes.includes(0x82))
      assert(legacy?.admitted.failure === 'legacyEncodingRequired', 'Legacy ambiguity was lost')
      legacy.cp437 = admitName(legacy.original, 'ibm437', oemMaps)
      legacy.windows1252 = admitName(legacy.original, 'windows-1252', oemMaps)
      assert(
        legacy.cp437.name === 'café.txt' && legacy.windows1252.name === 'caf‚.txt',
        'Browser legacy decoding differs'
      )
      const malformed = await readNames(factory, await read('/names/invalid-legacy-unicode.rar'))
      const malformedUnicode = malformed.find(
        (entry) => entry.admitted.failure === 'invalidEncoding'
      )
      assert(malformedUnicode?.dllName === 'A', 'Malformed Unicode repair was not rejected')
      postMessage({
        runs,
        legacy,
        malformedUnicode,
        allAssertionsPassed: true,
        fullLegacyEncodingPolicyChosen: false
      })
    } else if (mode === 'cfi') {
      const { default: factory } = await import('/xml-build/expat.mjs')
      const { runCfiCases } = await import('./cfi-cases.mjs')
      const { ZipReader, Uint8ArrayReader, Uint8ArrayWriter, configure } =
        await import('/zip/index.js')
      configure({ useWebWorkers: false })
      const archive = await read('/source.epub'),
        expected = await json('/epub-fixture-input.json')
      assert((await sha256(archive)) === expected.sha256, 'EPUB fixture changed')
      const reader = new ZipReader(new Uint8ArrayReader(archive))
      const documents = new Map()
      try {
        for (const entry of await reader.getEntries())
          if (entry.filename !== 'mimetype') {
            const bytes = await entry.getData(new Uint8ArrayWriter())
            assert(
              (await sha256(bytes)) === expected.documents[entry.filename],
              'EPUB member changed'
            )
            documents.set(entry.filename, bytes)
          }
      } finally {
        await reader.close()
      }
      postMessage({
        ...(await runCfiCases(factory, documents)),
        actualZipMembers: documents.size,
        archiveClosed: true
      })
    } else if (mode === 'mobi') {
      const { MOBI } = await import('/foliate-raw.mjs')
      const { createMarkupMapper } = await import('./markup-map.mjs')
      const parse = createMarkupMapper(await import('/parse5.mjs'), await json('/oem-maps.json'))
      const expected = await json('/mobi-result.json'),
        mapped = await json('/markup-result.json')
      const raw = []
      for (const sample of expected.runs) {
        const bytes = await read('/mobi/' + sample.name)
        assert((await sha256(bytes)) === sample.sourceSha256, 'MOBI source changed')
        for (const branch of sample.branches) {
          const source = await new MOBI({}).openRawForProof(
            new File([bytes], sample.name),
            branch.record
          )
          const parts = []
          for (let i = 0; i < source.headers.palmdoc.numTextRecords; i++)
            parts.push(await source.loadText(i))
          const combined = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
          let offset = 0
          for (const part of parts) {
            combined.set(part, offset)
            offset += part.length
          }
          assert((await sha256(combined)) === branch.rawSha256, 'Browser raw MOBI branch differs')
          raw.push({
            sample: sample.name,
            record: branch.record,
            rawBytes: combined.length,
            sha256: branch.rawSha256
          })
        }
      }
      const mapping = []
      for (const item of mapped.runs) {
        const bytes = await read('/mobi/' + item.name)
        const first = parse(bytes, item.encoding, 7),
          second = parse(bytes, item.encoding, 4096)
        assert(first.units.length === item.sourceUnits, 'Browser source unit count differs')
        let points = 0
        for (const unit of first.units) {
          const a = first.resolve(unit.byteStart),
            b = second.resolve(unit.byteStart)
          assert(
            a.offset === b.offset &&
              a.node.value === b.node.value &&
              b.node.value.slice(b.offset, b.offset + unit.value.length) === unit.value,
            'Browser source mapping differs'
          )
          points++
        }
        mapping.push({ name: item.name, points, inputChunkSizes: [7, 4096] })
      }
      postMessage({
        raw,
        mapping,
        allAssertionsPassed: true,
        fullMarkupMappingProved: false,
        fixedKf8FixtureIncluded: false
      })
    } else throw new Error('Unknown proof mode')
  } catch (error) {
    postMessage({ error: error.stack })
  }
}
