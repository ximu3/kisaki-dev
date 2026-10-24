// Verify byte-declaration agreement, format policy, lazy loading, and actual cleanup.
import { createXmlEntry, EntryFailure } from './input.mjs'
const assert = (value, message) => {
  if (!value) throw new Error(message)
}
const decode64 = (value) => Uint8Array.from(atob(value), (letter) => letter.charCodeAt(0))
const sourceText = (node) =>
  typeof node === 'string' ? node : node.children.map(sourceText).join('')

export async function runEntryCases(
  xmlFactory,
  codecFactory,
  registry,
  catalog,
  fixtures,
  options = {}
) {
  let codec
  let loads = 0
  let accesses = 0
  const load = async () => {
    accesses++
    if (!codec) {
      loads++
      codec = await codecFactory()
    }
    return codec
  }
  const entry = await createXmlEntry(xmlFactory, load, registry, catalog)
  const cases = []
  for (const fixture of fixtures.cases) {
    const bytes = decode64(fixture.bytes)
    const attempts = []
    for (const chunk of fixture.chunks ?? [1, 3, 4096]) {
      let closed = false
      const source = async function* () {
        try {
          for (let offset = 0; offset < bytes.length; offset += chunk)
            yield bytes.subarray(offset, offset + chunk)
        } finally {
          closed = true
        }
      }
      const before = accesses
      let result
      let failure
      try {
        result = await entry.parse(source(), fixture.options)
      } catch (error) {
        if (!(error instanceof EntryFailure)) throw error
        failure = { code: error.code, reason: error.reason }
      }
      assert(closed, 'The source iterator did not finish: ' + fixture.name)
      assert(entry.activeParsers === 0, 'An XML parser survived: ' + fixture.name)
      assert(!codec || codec._kana_codec_active() === 0, 'A converter survived: ' + fixture.name)
      if (fixture.code) {
        assert(
          !result &&
            failure?.code === fixture.code &&
            (!fixture.reason || failure.reason === fixture.reason),
          'Unexpected entry failure: ' + fixture.name + ' ' + JSON.stringify(failure)
        )
        attempts.push({ chunk, failure, partialResultPublished: false, sourceClosed: true })
        const recovery = await entry.parse([new TextEncoder().encode('<r>fresh</r>')])
        assert(sourceText(recovery.tree) === 'fresh', 'A failed input changed the next parse.')
      } else {
        assert(
          result && !failure,
          'A valid XML input failed: ' + fixture.name + ' ' + JSON.stringify(failure)
        )
        if (fixture.expectedTree)
          assert(
            JSON.stringify(result.tree) === JSON.stringify(fixture.expectedTree),
            'The expected source tree changed: ' + fixture.name
          )
        if (fixture.text !== undefined)
          assert(
            sourceText(result.tree) === fixture.text,
            'The decoded text changed: ' + fixture.name
          )
        if (fixture.route)
          assert(result.route === fixture.route, 'The route changed: ' + fixture.name)
        if (fixture.canonical)
          assert(result.canonical === fixture.canonical, 'The codec changed: ' + fixture.name)
        assert(
          accesses - before === (result.route === 'native' ? 0 : 1),
          'A native input loaded a converter.'
        )
        attempts.push({
          chunk,
          canonical: result.canonical,
          effective: result.effective,
          route: result.route,
          prefixBytes: result.prefixBytes,
          sourceBytes: result.sourceBytes,
          parserBytes: result.parserBytes,
          catalogUses: result.catalogUses,
          sourceClosed: true
        })
      }
    }
    cases.push({ name: fixture.name, attempts })
  }
  const extra = []
  if (options.fixturesOnly)
    return {
      cases,
      extra,
      codecModuleLoads: loads,
      registryAliases: Object.keys(registry.labels).length,
      registryCanonical: registry.canonical.length,
      activeParsers: entry.activeParsers,
      activeDecoders: codec?._kana_codec_active() ?? 0,
      fullReader: false,
      allCodecsConformance: false
    }
  async function reject(name, action, expected) {
    let code
    try {
      await action()
    } catch (error) {
      if (!(error instanceof EntryFailure)) throw error
      code = error.code
    }
    assert(code === expected, 'Unexpected lifecycle result: ' + name)
    assert(
      entry.activeParsers === 0 && (!codec || codec._kana_codec_active() === 0),
      'A lifecycle failure retained an active parser.'
    )
    extra.push({
      name,
      code,
      activeParsers: entry.activeParsers,
      activeDecoders: codec?._kana_codec_active() ?? 0
    })
  }
  const alreadyAborted = new AbortController()
  alreadyAborted.abort()
  let touched = false
  await reject(
    'pre-aborted-does-not-read',
    () =>
      entry.parse(
        {
          [Symbol.asyncIterator]() {
            touched = true
            throw new Error('The source should not be touched.')
          }
        },
        { signal: alreadyAborted.signal }
      ),
    'cancelled'
  )
  assert(!touched, 'An already cancelled operation touched its source.')
  for (const count of [3, 12]) {
    const controller = new AbortController()
    let released = false
    let releaseStarted = false
    const bytes = new TextEncoder().encode(
      '<?xml version="1.0" encoding="windows-1252"?><r>' + 'x'.repeat(256) + '</r>'
    )
    const source = async function* () {
      try {
        let delivered = 0
        for (let offset = 0; offset < bytes.length; offset += 7) {
          yield bytes.subarray(offset, offset + 7)
          if (++delivered === count) controller.abort()
        }
      } finally {
        releaseStarted = true
        await new Promise((resolve) => setTimeout(resolve, 20))
        released = true
      }
    }
    await reject(
      count === 3 ? 'cancel-during-prefix' : 'cancel-during-transcoded-body',
      () => entry.parse(source(), { signal: controller.signal }),
      'cancelled'
    )
    assert(releaseStarted && released, 'Cancellation completed before the source cleanup.')
  }
  for (const changed of [false, true]) {
    let closed = false
    const source = async function* () {
      try {
        yield new TextEncoder().encode('<r>')
        if (changed) throw new EntryFailure('sourceChanged', 'testSourceChanged')
        throw new Error('Injected source read failure.')
      } finally {
        closed = true
      }
    }
    await reject(
      changed ? 'known-source-change' : 'source-read-failure',
      () => entry.parse(source()),
      changed ? 'sourceChanged' : 'readFailed'
    )
    assert(closed, 'A failed source was not closed.')
  }
  const missing = await createXmlEntry(
    xmlFactory,
    async () => {
      throw new Error('Injected asset failure.')
    },
    registry,
    catalog
  )
  await reject(
    'codec-asset-unavailable',
    () =>
      missing.parse([new TextEncoder().encode('<?xml version="1.0" encoding="CP1252"?><r>A</r>')]),
    'assetUnavailable'
  )
  assert(missing.activeParsers === 0, 'Asset failure retained the XML parser.')
  let returnFinished = false
  await reject(
    'source-close-failure',
    () =>
      entry.parse({
        [Symbol.asyncIterator]() {
          let first = true
          return {
            async next() {
              if (!first) return { done: true }
              first = false
              return { done: false, value: new TextEncoder().encode('<r>A</r>') }
            },
            async return() {
              returnFinished = true
              throw new Error('Injected cleanup failure.')
            }
          }
        }
      }),
    'readFailed'
  )
  assert(returnFinished, 'Source closing did not finish.')
  let combinedFailure
  await reject(
    'source-change-survives-cleanup-failure',
    async () => {
      try {
        await entry.parse({
          [Symbol.asyncIterator]() {
            return {
              async next() {
                throw new EntryFailure('sourceChanged', 'testSourceChanged')
              },
              async return() {
                throw new Error('Injected cleanup failure.')
              }
            }
          }
        })
      } catch (error) {
        combinedFailure = error
        throw error
      }
    },
    'sourceChanged'
  )
  assert(
    combinedFailure.cause instanceof AggregateError && combinedFailure.cause.errors.length === 2,
    'A combined failure discarded one of its causes.'
  )
  return {
    cases,
    extra,
    codecModuleLoads: loads,
    registryAliases: Object.keys(registry.labels).length,
    registryCanonical: registry.canonical.length,
    activeParsers: entry.activeParsers,
    activeDecoders: codec?._kana_codec_active() ?? 0,
    fullReader: false,
    allCodecsConformance: false
  }
}
