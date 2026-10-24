// Read owned binary KF8 inputs before resource replacement and HTML display construction.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createMarkupMapper } from '../kana-source-mapping/markup.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const cache = path.resolve(here, '../../../../node_modules/.cache')
const folder = path.join(cache, 'kana-kf8-fixed')
const output = path.join(folder, 'decoded')
await mkdir(output, { recursive: true })
const hash = (value) => createHash('sha256').update(value).digest('hex')
const json = async (file) => JSON.parse(await readFile(file, 'utf8'))
const expected = await json(path.join(folder, 'books/expected.json'))
const adapter = await json(path.join(here, '../kana-formats/mobi-adapter-input.json'))
const adapterFile = path.join(cache, 'kana-formats/foliate-raw.mjs')
assert.equal(hash(await readFile(adapterFile)), adapter.adaptedSha256)
const { MOBI, getIndexData, concatTypedArray3 } = await import(pathToFileURL(adapterFile))
const parse5File = path.join(cache, 'kana-formats/parse5.mjs')
const parse5 = await import(pathToFileURL(parse5File))
const mapsFile = path.join(cache, 'kana-xml-input/encoding-maps.json')
const parse = createMarkupMapper(parse5, await json(mapsFile))
const allText = (node) =>
  node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(allText).join('')
const descendants = (node, result = []) => {
  result.push(node)
  node.childNodes?.forEach((child) => descendants(child, result))
  return result
}
const attr = (node, name) => node.attrs?.find((item) => item.name === name)?.value
function viewport(value) {
  const match = /^(\d+)x(\d+)$/.exec(value ?? '')
  if (!match) return { failure: 'invalidDocument' }
  const [width, height] = match.slice(1).map(Number)
  if (![width, height].every((item) => Number.isSafeInteger(item) && item > 0))
    return { failure: 'invalidDocument' }
  return { width, height }
}
const runs = []
const viewportCases = [
  '480x640',
  '0480x0640',
  '',
  '0x640',
  '480x0',
  '-1x640',
  '480.0x640',
  '480x640junk'
].map((value, index) => {
  const result = viewport(value)
  assert.equal(Boolean(result.failure), index >= 2)
  return { value, result }
})
let restoredEndpoints = 0
for (const fixture of expected.files) {
  const bytes = await readFile(path.join(folder, 'books', fixture.name))
  assert.equal(hash(bytes), fixture.sha256)
  const source = await new MOBI({}).openRawForProof(new File([bytes], fixture.name), 0)
  const { palmdoc, mobi, kf8, exth } = source.headers
  assert.equal(mobi.version, 8)
  assert.equal(mobi.encoding, 65001)
  assert.equal(palmdoc.encryption, 0)
  assert.equal(palmdoc.compression, fixture.compressed ? 2 : 1)
  assert.equal(exth.fixedLayout, 'true')
  assert.equal(exth.originalResolution ?? '', fixture.resolution)
  assert.equal(exth.pageProgressionDirection ?? 'ltr', fixture.rightToLeft ? 'rtl' : 'ltr')
  const recordLengths = []
  const parts = []
  for (let index = 0; index < palmdoc.numTextRecords; index++) {
    const part = Buffer.from(await source.loadText(index))
    recordLengths.push(part.length)
    parts.push(part)
  }
  const raw = Buffer.concat(parts)
  const recordZero = bytes.readUInt32BE(78)
  assert.equal(raw.length, bytes.readUInt32BE(recordZero + 4))
  const fdst = Buffer.from(await source.loadRecord(kf8.fdst))
  assert.equal(fdst.subarray(0, 4).toString(), 'FDST')
  assert.equal(fdst.readUInt32BE(4), 12)
  const count = fdst.readUInt32BE(8)
  assert.equal(count, 2)
  const flows = Array.from({ length: count }, (_, index) => ({
    start: fdst.readUInt32BE(12 + index * 8),
    end: fdst.readUInt32BE(16 + index * 8)
  }))
  let lastEnd = 0
  for (const flow of flows) {
    assert.equal(flow.start, lastEnd)
    assert(flow.end >= flow.start && flow.end <= raw.length)
    lastEnd = flow.end
  }
  assert.equal(lastEnd, raw.length)
  const css = raw.subarray(flows[1].start, flows[1].end)
  assert.equal(css.toString('utf8'), expected.css)
  const loadRecord = source.loadRecord.bind(source)
  const skels = (await getIndexData(kf8.skel, loadRecord)).table.map(({ name, tagMap }, index) => ({
    index,
    name,
    numFrag: tagMap[1][0],
    offset: tagMap[6][0],
    length: tagMap[6][1]
  }))
  const fragments = (await getIndexData(kf8.frag, loadRecord)).table.map(({ name, tagMap }) => ({
    insertOffset: Number(name),
    index: tagMap[4][0],
    offset: tagMap[6][0],
    length: tagMap[6][1]
  }))
  assert.equal(skels.length, fixture.pages)
  let fragmentStart = 0
  const documents = []
  for (const skel of skels) {
    assert(
      [skel.numFrag, skel.offset, skel.length].every(
        (value) => Number.isSafeInteger(value) && value >= 0
      )
    )
    assert(skel.offset + skel.length <= flows[0].end)
    const selected = fragments.slice(fragmentStart, fragmentStart + skel.numFrag)
    assert.equal(selected.length, skel.numFrag)
    fragmentStart += skel.numFrag
    let document = raw.subarray(skel.offset, skel.offset + skel.length)
    for (const fragment of selected) {
      const insertion = fragment.insertOffset - skel.offset
      const sourceStart = skel.offset + skel.length + fragment.offset
      const sourceEnd = sourceStart + fragment.length
      assert(
        [insertion, sourceStart, sourceEnd].every(
          (value) => Number.isSafeInteger(value) && value >= 0
        )
      )
      assert(insertion <= document.length && sourceEnd <= flows[0].end)
      document = Buffer.from(
        concatTypedArray3(
          document.subarray(0, insertion),
          raw.subarray(sourceStart, sourceEnd),
          document.subarray(insertion)
        )
      )
    }
    const filename = `${fixture.name}.${skel.index}.html`
    await writeFile(path.join(output, filename), document)
    const parsed = parse(document, 'utf-8', 1)
    const nodes = descendants(parsed.tree)
    const original = parse(new TextEncoder().encode(expected.sourceBodies[skel.index]))
    const expectedText = allText(original.tree)
    const body = nodes.find((node) => node.tagName === 'body')
    assert.equal(allText(body).trim(), expectedText)
    const anchors = []
    const bodyNodes = new Set(descendants(body))
    for (const unit of parsed.units) {
      for (const projected of unit.projections) {
        if (!bodyNodes.has(projected.node) || !unit.value.length) continue
        for (const offset of [0, unit.value.length]) {
          const sourcePoint = parsed.fromText(projected.node, projected.offset + offset)
          const reopened = parse(document, 'utf-8', 7)
          const target = reopened.resolve(sourcePoint.byteOffset, sourcePoint.textOffset)
          assert(
            target.projections.some(
              (other) =>
                other.node.value === projected.node.value &&
                other.offset === projected.offset + offset
            )
          )
          anchors.push({ documentIndex: skel.index, ...sourcePoint })
          restoredEndpoints++
        }
      }
    }
    const images = nodes
      .filter((node) => node.tagName === 'img')
      .map((node) => {
        const tag = parsed.tags.find((item) => item.nodes.includes(node))
        assert(tag && parsed.resolve(tag.byteStart).nodes.includes(node))
        return {
          id: attr(node, 'id') ?? null,
          src: attr(node, 'src'),
          width: Number(attr(node, 'width')),
          height: Number(attr(node, 'height')),
          address: { documentIndex: skel.index, byteOffset: tag.byteStart }
        }
      })
    if (skel.index === 1) {
      assert.equal(expectedText, '')
      assert.equal(images.length, 1)
    }
    documents.push({
      documentIndex: skel.index,
      filename,
      bytes: document.length,
      sha256: hash(document),
      skeleton: skel,
      fragments: selected,
      text: expectedText,
      hasNonWhitespaceSourceText: Boolean(expectedText.trim()),
      anchors,
      images,
      links: nodes.filter((node) => node.tagName === 'a').map((node) => attr(node, 'href')),
      styles: nodes.filter((node) => node.tagName === 'link').map((node) => attr(node, 'href'))
    })
  }
  assert.equal(fragmentStart, fragments.length)
  for (const document of documents) {
    document.linkTargets = []
    for (const href of document.links) {
      const match = /^kindle:pos:fid:([0-9A-V]+):off:([0-9A-V]+)$/.exec(href)
      assert(match)
      const fid = Number.parseInt(match[1], 32),
        offset = Number.parseInt(match[2], 32)
      const targetDocument = documents.find((item) =>
        item.fragments.some((fragment) => fragment.index === fid)
      )
      assert(targetDocument && Number.isSafeInteger(offset))
      const fragment = targetDocument.fragments.find((item) => item.index === fid)
      assert(offset >= 0 && offset < fragment.length)
      const address = {
        documentIndex: targetDocument.documentIndex,
        byteOffset: fragment.insertOffset - targetDocument.skeleton.offset + offset
      }
      const targetSource = parse(
        await readFile(path.join(output, targetDocument.filename)),
        'utf-8',
        3
      )
      const target = targetSource.resolve(address.byteOffset)
      assert(target.nodes.some((node) => attr(node, 'id') === 'last'))
      document.linkTargets.push(address)
    }
  }
  const picture = Buffer.from(await source.loadResource(0))
  assert.equal(picture.subarray(0, 2).toString('hex'), 'ffd8')
  await writeFile(path.join(output, fixture.name + '.jpg'), picture)
  await writeFile(path.join(output, fixture.name + '.css'), css)
  const view = viewport(exth.originalResolution)
  assert.equal(Boolean(view.failure), !fixture.resolution || fixture.resolution === '0x640')
  runs.push({
    name: fixture.name,
    sourceSha256: hash(bytes),
    compression: palmdoc.compression,
    recordLengths,
    trailingFlags: mobi.trailingFlags,
    rawBytes: raw.length,
    rawSha256: hash(raw),
    flows,
    fixedLayout: true,
    direction: exth.pageProgressionDirection ?? 'ltr',
    viewport: view,
    documents,
    imageSha256: hash(picture),
    cssSha256: hash(css),
    rawResourceBytes: picture.length
  })
}
for (const run of runs) {
  assert.deepEqual(
    run.documents.map((item) => [item.documentIndex, item.sha256]),
    runs[0].documents.map((item) => [item.documentIndex, item.sha256])
  )
  assert.equal(run.rawSha256, runs[0].rawSha256)
  assert.equal(run.imageSha256, runs[0].imageSha256)
}
const report = {
  checkedAt: new Date().toISOString(),
  node: process.version,
  harnessSha256: hash(await readFile(fileURLToPath(import.meta.url))),
  sourceInputSha256: hash(await readFile(path.join(here, 'source-input.json'))),
  inputs: {
    adapter: hash(await readFile(adapterFile)),
    parse5: hash(await readFile(parse5File)),
    encodingMaps: hash(await readFile(mapsFile)),
    mapper: hash(await readFile(path.join(here, '../kana-source-mapping/markup.mjs')))
  },
  runs,
  viewportCases,
  restoredEndpoints,
  compressionAndDirectionPreserveDocuments: true,
  independentWriter: true,
  independentRawDecoder: false,
  fullReader: false,
  kindleDeviceCompatibility: false
}
await writeFile(path.join(here, 'node-contract.json'), JSON.stringify(report, null, 2) + '\n')
process.stdout.write(
  JSON.stringify({
    files: runs.length,
    documents: runs[0].documents.length,
    restoredEndpoints,
    validViewports: runs.filter((run) => !run.viewport.failure).length
  }) + '\n'
)
