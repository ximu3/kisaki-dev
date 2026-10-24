// Join existing source and search mechanisms, and read one independently written ZIP.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createMarkupMapper } from '../kana-source-mapping/markup.mjs'
import { createOrder } from '../kana-image-order/order.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const cache = path.resolve(here, '../../../../node_modules/.cache')
const json = async (file) => JSON.parse(await readFile(file, 'utf8'))
const hash = (value) => createHash('sha256').update(value).digest('hex')
const parserFile = path.join(cache, 'kana-formats/parse5.mjs')
const parse5 = await import(pathToFileURL(parserFile))
const mapsFile = path.join(cache, 'kana-xml-input/encoding-maps.json')
const parse = createMarkupMapper(parse5, await json(mapsFile))
const foldingFile = path.join(cache, 'kana-content/casefold.json')
const folding = await json(foldingFile)
const fold = (text) =>
  Array.from(
    text,
    (character) =>
      folding.map[character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')] ?? character
  )
    .join('')
    .normalize('NFC')
const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' })
const markup = '<p>Stra<span>ße</span> Cafe<i>&#x301;</i>。</p>'
const bytes = new TextEncoder().encode(markup)
const source = parse(bytes, 'utf-8', 3)
const entries = source.units.filter((unit) => unit.projections.length && unit.value)
const original = entries.map((unit) => unit.value).join('')
assert.equal(original, 'Straße Cafe\u0301。')
const origins = entries.flatMap((unit) =>
  Array.from({ length: unit.value.length }, (_, offset) => ({
    start: { byteOffset: unit.byteStart, textOffset: offset },
    end: { byteOffset: unit.byteStart, textOffset: offset + 1 }
  }))
)
let transformed = ''
const transformedOrigins = []
for (const { segment, index } of graphemes.segment(original)) {
  const output = fold(segment)
  transformed += output
  for (let offset = 0; offset < output.length; offset++)
    transformedOrigins.push({
      start: origins[index].start,
      end: origins[index + segment.length - 1].end
    })
}
const textCases = []
for (const [query, expected] of [
  ['STRASSE', 'Straße'],
  ['CAFÉ', 'Cafe\u0301']
]) {
  const start = transformed.indexOf(fold(query))
  assert(start >= 0)
  const range = {
    start: transformedOrigins[start].start,
    end: transformedOrigins[start + fold(query).length - 1].end
  }
  const reopened = parse(bytes, 'utf-8', 1)
  const one = reopened.resolve(range.start.byteOffset, range.start.textOffset)
  const two = reopened.resolve(range.end.byteOffset, range.end.textOffset)
  const quote = reopened.units
    .map((unit) => {
      const begin = Math.max(one.ordinal, unit.ordinal)
      const end = Math.min(two.ordinal, unit.ordinal + unit.value.length)
      return end > begin ? unit.value.slice(begin - unit.ordinal, end - unit.ordinal) : ''
    })
    .join('')
  assert.equal(quote, expected)
  textCases.push({ query, quote, range })
}
const zipRoot = path.join(cache, 'kana-design/zip/package')
const { ZipReader, Uint8ArrayReader, Uint8ArrayWriter } = await import(
  pathToFileURL(path.join(zipRoot, 'index.js'))
)
const expected = await json(path.join(cache, 'kana-format-integration/expected.json'))
const archiveBytes = await readFile(path.join(cache, 'kana-format-integration/pages.cbz'))
assert.equal(hash(archiveBytes), expected.archiveSha256)
const unicodeFile = path.join(cache, 'kana-image-order/unicode.json')
const compare = createOrder(await json(unicodeFile))
const hasPngSignature = (bytes) =>
  [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
const reader = new ZipReader(new Uint8ArrayReader(archiveBytes), { useWebWorkers: false })
const archivePages = []
const directoryPages = []
try {
  for await (const entry of reader.getEntriesGenerator()) {
    const actual = await entry.getData(new Uint8ArrayWriter(), { checkSignature: true })
    const directory = await readFile(
      path.join(cache, 'kana-format-integration/directory', entry.filename)
    )
    assert.deepEqual(Buffer.from(actual), directory)
    const originalMember = expected.members.find((item) => item.name === entry.filename)
    assert.equal(hash(actual), originalMember.sha256)
    if (hasPngSignature(actual)) archivePages.push(entry.filename)
    if (hasPngSignature(directory)) directoryPages.push(entry.filename)
  }
} finally {
  await reader.close()
}
archivePages.sort(compare)
directoryPages.sort(compare)
assert.deepEqual(archivePages, expected.expectedPages)
assert.deepEqual(directoryPages, expected.expectedPages)
const report = {
  checkedAt: new Date().toISOString(),
  node: process.version,
  purpose: 'One integration check; existing isolated format suites were not rerun.',
  sources: Object.fromEntries(
    await Promise.all(
      ['prepare.py', 'run.mjs'].map(async (name) => [
        name,
        hash(await readFile(path.join(here, name)))
      ])
    )
  ),
  inputs: {
    parser: hash(await readFile(parserFile)),
    encodingMaps: hash(await readFile(mapsFile)),
    caseFolding: hash(await readFile(foldingFile)),
    unicodeOrder: hash(await readFile(unicodeFile)),
    mapper: hash(await readFile(path.join(here, '../kana-source-mapping/markup.mjs'))),
    ordering: hash(await readFile(path.join(here, '../kana-image-order/order.mjs'))),
    zipPackage: hash(await readFile(path.join(zipRoot, 'package.json'))),
    archive: hash(archiveBytes)
  },
  textCases,
  archivePages,
  directoryPages,
  zipClosed: true,
  limits: {
    renderedTextEligibility: false,
    allImageTypes: false,
    imagePixelsDecoded: false,
    largeBookPerformance: false,
    fullReader: false
  }
}
await writeFile(
  path.join(here, 'integration-contract.json'),
  JSON.stringify(report, null, 2) + '\n'
)
process.stdout.write(
  JSON.stringify({ textCases: textCases.length, archivePages, directoryPages }) + '\n'
)
