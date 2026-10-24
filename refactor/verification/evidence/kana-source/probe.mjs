// Compare persisted addresses with independent fixture expectations across fresh parses and DOMs.
import {
  SourceFailure,
  requireBoundary,
  decode,
  parseXml,
  createModel,
  createView
} from './source.mjs'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const persisted = (anchor) => JSON.parse(JSON.stringify({ type: 'anchor', anchor })).anchor
function expectFailure(action, reason) {
  try {
    action()
  } catch (error) {
    assert(
      error instanceof SourceFailure && error.reason === reason,
      `Unexpected source failure; wanted ${reason}`
    )
    return
  }
  throw new Error(`An invalid source address was accepted: ${reason}`)
}
function boundaries(text) {
  const offsets = []
  for (let i = 0; i <= text.length; i++) {
    const before = text.charCodeAt(i - 1),
      after = text.charCodeAt(i)
    if (!(before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff))
      offsets.push(i)
  }
  return offsets
}
async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}
async function openFixture(fixture, chunkSize) {
  const bytes = new Uint8Array(
    await (await fetch(`fixtures/${fixture.name}`, { cache: 'no-store' })).arrayBuffer()
  )
  assert((await sha256(bytes)) === fixture.sha256, 'Fixture bytes changed')
  const result = decode(bytes, fixture.encoding, chunkSize)
  const source = fixture.format === 'txt' ? result.text : parseXml(result.text)
  assert(
    equal(source, fixture.format === 'txt' ? fixture.expected : fixture.expectedTree),
    `Independent expectation differs: ${fixture.name}`
  )
  return { model: createModel(fixture.format, source, fixture.encoding), chunks: result.chunks }
}
function sourceEntries(tree, path = [], output = []) {
  if (tree.kind === 'text') output.push({ kind: 'text', path, text: tree.text })
  else tree.children.forEach((child, index) => sourceEntries(child, [...path, index], output))
  return output
}
function collectRanges(model, fixture) {
  const entries =
    fixture.format === 'txt'
      ? [{ path: [], text: fixture.expected }]
      : sourceEntries(fixture.expectedTree)
  const ranges = []
  const toAnchor = (entry, offset) => model.anchor(entry, offset)
  if (fixture.format === 'txt') {
    const offsets = boundaries(entries[0].text)
    for (let i = 0; i < offsets.length; i++)
      for (let j = i + 1; j < offsets.length; j++)
        ranges.push({
          start: toAnchor(entries[0], offsets[i]),
          end: toAnchor(entries[0], offsets[j]),
          expected: entries[0].text.slice(offsets[i], offsets[j])
        })
  } else {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      ranges.push({
        start: toAnchor(entry, 0),
        end: toAnchor(entry, entry.text.length),
        expected: entry.text
      })
      if (i + 1 < entries.length)
        ranges.push({
          start: toAnchor(entry, 0),
          end: toAnchor(entries[i + 1], entries[i + 1].text.length),
          expected: entry.text + entries[i + 1].text
        })
    }
    ranges.push({
      start: toAnchor(entries[0], 0),
      end: toAnchor(entries.at(-1), entries.at(-1).text.length),
      expected: entries.map((entry) => entry.text).join('')
    })
    const from = entries.findIndex((entry) => equal(entry.path, [3, 1, 3, 1, 0]))
    const to = entries.findIndex((entry) => equal(entry.path, [3, 3, 1, 0]))
    assert(from >= 0 && to > from, 'Chapter source paths changed')
    ranges.push({
      start: toAnchor(entries[from], 1),
      end: toAnchor(entries[to], entries[to].text.length - 1),
      expected: entries
        .slice(from, to + 1)
        .map((entry, index) =>
          index === 0
            ? entry.text.slice(1)
            : index === to - from
              ? entry.text.slice(0, -1)
              : entry.text
        )
        .join('')
    })
  }
  return ranges
}
function checkXmlPaths(tree) {
  const body = tree.children[3],
    first = body.children[1]
  assert(
    body.name === 'body' && first.name === 'section',
    'Whitespace or metadata lost its source index'
  )
  assert(
    first.children[1].children.length === 1 &&
      first.children[1].children[0].text === '甲乙丙😀丁戊',
    'CDATA, comments, and processing instructions changed text identity'
  )
  assert(
    first.children[2].children[0].text === 'A\nB\nC\nD\rE😀 é é',
    'XML line ends or character references changed'
  )
  assert(
    first.children[3].children.length === 6,
    'Attributes or namespaces entered child numbering'
  )
  assert(first.children[4].children.length === 0, 'Empty element gained a logical text child')
}

async function roundTrip(fixture, chunkSize, fragmentSize) {
  const first = await openFixture(fixture, chunkSize)
  const model = first.model,
    view = createView(model, fragmentSize)
  if (fixture.format === 'fb2') checkXmlPaths(model.tree)
  const saved = []
  let rejectedSurrogates = 0,
    rejectionChecks = 0
  for (const entry of model.texts) {
    for (const offset of boundaries(entry.text)) {
      const anchor = model.anchor(entry, offset),
        point = view.resolve(anchor)
      const captured = view.capture(point.node, point.offset)
      assert(equal(anchor, captured), 'DOM capture changed the source point')
      saved.push(persisted(captured))
    }
    for (let offset = 0; offset <= entry.text.length; offset++)
      if (!boundaries(entry.text).includes(offset)) {
        expectFailure(() => view.resolve(model.anchor(entry, offset)), 'invalidBoundary')
        rejectedSurrogates++
      }
    for (const offset of [-1, entry.text.length + 1, 0.5, NaN]) {
      expectFailure(() => model.locate(model.anchor(entry, offset)), 'invalidBoundary')
      rejectionChecks++
    }
  }
  for (const entry of model.elements) {
    const anchor = model.anchor(entry),
      point = view.resolve(anchor)
    assert(equal(anchor, view.capture(point.node, point.offset)), 'Element anchor changed')
    saved.push(persisted(anchor))
    expectFailure(() => model.locate({ ...anchor, textOffset: 0 }), 'invalidBoundary')
    rejectionChecks++
  }
  const decoration = view.root.querySelector('[data-decoration]').firstChild
  expectFailure(() => view.capture(decoration, 0), 'noSource')
  rejectionChecks++
  if (fixture.format === 'txt') {
    expectFailure(
      () =>
        model.locate({
          type: 'textOffset',
          encoding: fixture.encoding === 'utf-8' ? 'utf-16le' : 'utf-8',
          offset: 0
        }),
      'wrongEncoding'
    )
    rejectionChecks++
  } else {
    for (const nodePath of [[999], [-1], [0.5], [3, 1, 4, 0]]) {
      expectFailure(() => model.locate({ type: 'xmlNode', nodePath }), 'missingNode')
      rejectionChecks++
    }
    expectFailure(
      () => model.locate({ type: 'xmlNode', nodePath: [3, 1, 1, 0] }),
      'invalidBoundary'
    )
    rejectionChecks++
  }
  const ranges = collectRanges(model, fixture)
  for (const range of ranges)
    assert(
      view.rangeText(range.start, range.end) === range.expected,
      'Source range differs before close'
    )
  const savedRanges = JSON.parse(
    JSON.stringify(
      ranges.map(({ start, end, expected }) => ({
        range: { type: 'anchors', start, end },
        expected
      }))
    )
  )
  const textNodes = model.texts.length,
    elementNodes = model.elements.length
  view.dispose()
  model.close()
  assert(
    view.retainedFragments === 0 &&
      model.texts.length === 0 &&
      model.elements.length === 0 &&
      model.tree === null,
    'Closed proof retained its source or display index'
  )
  expectFailure(() => model.locate(saved[0]), 'closed')
  const reopened = await openFixture(fixture, chunkSize === 1 ? 7 : 1)
  const next = createView(reopened.model, fragmentSize === 1 ? 11 : 1)
  for (const anchor of saved) {
    const point = next.resolve(anchor)
    assert(
      equal(next.capture(point.node, point.offset), anchor),
      'Fresh parse or fragmentation changed a saved source point'
    )
  }
  for (const { range, expected } of savedRanges)
    assert(
      next.rangeText(range.start, range.end) === expected,
      'Persisted source range changed after reopening'
    )
  next.dispose()
  reopened.model.close()
  assert(next.retainedFragments === 0, 'Reopened view retained its display index')
  return {
    inputChunkBytes: chunkSize,
    displayFragmentUnits: fragmentSize,
    reopenChunkBytes: chunkSize === 1 ? 7 : 1,
    reopenDisplayFragmentUnits: fragmentSize === 1 ? 11 : 1,
    inputChunks: first.chunks,
    textNodes,
    elementNodes,
    persistedPoints: saved.length,
    persistedRanges: ranges.length,
    rejectedSurrogates,
    rejectionChecks,
    closedIndexes: true
  }
}

function xmlAdmission() {
  const root =
    '<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><body><section><p>left&ext;right</p></section></body></FictionBook>'
  const url = location.origin + '/external-entity.xml'
  const samples = [
    {
      name: 'external-dtd',
      xml: `<!DOCTYPE FictionBook SYSTEM "${url}">${root.replace('&ext;', '')}`
    },
    {
      name: 'external-general-entity',
      xml: `<!DOCTYPE FictionBook [<!ENTITY ext SYSTEM "${url}">]>${root}`
    },
    {
      name: 'external-parameter-entity',
      xml: `<!DOCTYPE FictionBook [<!ENTITY % source SYSTEM "${url}">%source;]>${root}`
    },
    {
      name: 'network-general-entity',
      xml: `<!DOCTYPE FictionBook [<!ENTITY ext SYSTEM "https://kana-invalid.example/external-entity.xml">]>${root}`
    },
    { name: 'unclosed-tag', xml: root.replace('&ext;', '').replace('</section>', '') },
    { name: 'undeclared-entity', xml: root },
    { name: 'illegal-character', xml: root.replace('&ext;', '&#0;') }
  ]
  return samples.map(({ name, xml }) => {
    let failure = null,
      parsedText = null
    try {
      parsedText = sourceEntries(parseXml(xml))
        .map((entry) => entry.text)
        .join('')
    } catch (error) {
      assert(error instanceof SourceFailure, 'Unexpected XML parser error')
      failure = error.reason
    }
    if (['unclosed-tag', 'undeclared-entity', 'illegal-character'].includes(name))
      assert(failure === 'invalidDocument', `Malformed XML was accepted: ${name}`)
    return { name, failure, parsedText }
  })
}

export async function run() {
  const fixtures = await (await fetch('fixtures.json')).json()
  const runs = []
  for (const fixture of fixtures.cases) {
    const cases = []
    for (const [chunkSize, fragmentSize] of [
      [1, 1],
      [2, 3],
      [7, 5],
      [64, 17]
    ])
      cases.push(await roundTrip(fixture, chunkSize, fragmentSize))
    runs.push({
      name: fixture.name,
      format: fixture.format,
      encoding: fixture.encoding,
      sha256: fixture.sha256,
      cases
    })
  }
  expectFailure(() => decode(new Uint8Array(), 'UTF-8', 1), 'noncanonicalEncoding')
  expectFailure(() => decode(new Uint8Array(), 'latin1', 1), 'noncanonicalEncoding')
  requireBoundary('é', 1)
  const admission = xmlAdmission()
  assert(
    document.body.querySelectorAll('div').length === 0,
    'Closed proof left display nodes attached'
  )
  return {
    fixtureOrigin: fixtures.fixtureOrigin,
    runs,
    admission,
    externalEntityAdmissionComplete: admission
      .filter((item) => item.name.includes('entity') || item.name === 'external-dtd')
      .every((item) => item.failure !== null),
    totals: {
      fixtures: runs.length,
      reopenCases: runs.reduce((sum, run) => sum + run.cases.length, 0),
      persistedPoints: runs
        .flatMap((run) => run.cases)
        .reduce((sum, item) => sum + item.persistedPoints, 0),
      persistedRanges: runs
        .flatMap((run) => run.cases)
        .reduce((sum, item) => sum + item.persistedRanges, 0),
      rejectedSurrogatePositions: runs
        .flatMap((run) => run.cases)
        .reduce((sum, item) => sum + item.rejectedSurrogates, 0)
    },
    allAddressAssertionsPassed: true,
    fragmentAndSourceIndexesAfterClose: document.body.querySelectorAll('div').length
  }
}
