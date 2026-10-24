import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { DOMParser } from '../../../../node_modules/.pnpm/@xmldom+xmldom@0.8.11/node_modules/@xmldom/xmldom/lib/index.js'
import {
  unzipSync,
  strFromU8
} from '../../../../node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/index.mjs'

// Execute only the reviewed, hash-pinned CFI data module against synthetic DOM data.
const root = new URL('./', import.meta.url)
const contract = JSON.parse(await readFile(new URL('source-contract.json', root), 'utf8'))
const receipt = contract.sources.find((item) => item.path === 'assets/foliate-js/src/epubcfi.js')
const response = await fetch(receipt.url, { signal: AbortSignal.timeout(20000) })
assert.equal(response.status, 200)
const bytes = Buffer.from(await response.arrayBuffer())
assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sha256)
const context = vm.createContext({})
const module = new vm.SourceTextModule(bytes.toString('utf8'), {
  context,
  importModuleDynamically() {
    throw new Error('Dynamic imports are outside this probe.')
  }
})
await module.link(() => {
  throw new Error('Dependencies are outside this data module probe.')
})
await module.evaluate({ timeout: 1000 })
const cfi = module.namespace
const checks = []
function check(name, operation) {
  operation()
  checks.push({ name, passed: true })
}
function requireBoundary(node, offset) {
  assert.ok(node)
  assert.ok(Number.isSafeInteger(offset) && offset >= 0)
  const text = node.nodeType === 3 || node.nodeType === 4
  const length = text ? node.nodeValue.length : node.childNodes.length
  assert.ok(offset <= length)
  if (text && offset > 0 && offset < length) {
    const before = node.nodeValue.charCodeAt(offset - 1)
    const after = node.nodeValue.charCodeAt(offset)
    assert.ok(!(before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff))
  }
}
function document(xml) {
  assert.ok(!xml.includes('<!DOCTYPE'))
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  for (const element of Array.from(doc.getElementsByTagName('*'))) {
    element.id = element.getAttribute('id') || undefined
  }
  // xmldom supplies the tree; this bounded endpoint model is not a browser Range.
  doc.createRange = () => ({
    setStart(node, offset = 0) {
      requireBoundary(node, offset)
      this.startContainer = node
      this.startOffset = offset
    },
    setEnd(node, offset = 0) {
      requireBoundary(node, offset)
      this.endContainer = node
      this.endOffset = offset
    },
    get collapsed() {
      return this.startContainer === this.endContainer && this.startOffset === this.endOffset
    }
  })
  return doc
}
const archiveBytes = await readFile(new URL('fixtures/library/file/novel.epub', root))
const archive = unzipSync(archiveBytes)
const packageDoc = document(strFromU8(archive['EPUB/package.opf']))
const chapter = document(strFromU8(archive['EPUB/one.xhtml']))
const items = Array.from(packageDoc.getElementsByTagName('itemref'))
const bases = cfi.fromElements(items)
check('Pinned package CFI names the actual spine item', () =>
  assert.equal(bases[0], 'epubcfi(/6/2[spine-one])')
)
check('Second spine item has its own package address', () =>
  assert.equal(bases[1], 'epubcfi(/6/4[spine-two])')
)
const first = chapter.getElementById('p1').firstChild
const range = chapter.createRange()
range.setStart(first, 0)
range.setEnd(first, 4)
const full = cfi.joinIndir(bases[0], cfi.fromRange(range))
check('Pinned fromRange preserves a UTF-16 range over the supplementary character', () =>
  assert.equal(full, 'epubcfi(/6/2[spine-one]!/4/2[p1],/1:0,/1:4)')
)
const parts = cfi.parse(full)
const top = parts.parent.shift()
check('Package path resolves to the expected itemref', () =>
  assert.equal(cfi.toElement(packageDoc, top).getAttribute('idref'), 'c1')
)
const restored = cfi.toRange(chapter, parts)
check('Pinned CFI endpoints resolve to the same original text node', () => {
  assert.equal(restored.startContainer, first)
  assert.equal(restored.endContainer, first)
  assert.equal(restored.startOffset, 0)
  assert.equal(restored.endOffset, 4)
})
check('Resolved source quote is preserved exactly', () =>
  assert.equal(first.nodeValue.slice(restored.startOffset, restored.endOffset), '星光🌙')
)
const nativeStart = cfi.collapse(full)
const nativeEnd = cfi.collapse(full, true)
check('Range collapses into two complete native anchor values', () => {
  assert.equal(nativeStart, 'epubcfi(/6/2[spine-one]!/4/2[p1]/1:0)')
  assert.equal(nativeEnd, 'epubcfi(/6/2[spine-one]!/4/2[p1]/1:4)')
})
check('Source comparison preserves endpoint order', () =>
  assert.ok(cfi.compare(nativeStart, nativeEnd) < 0)
)
check('Native boundary validation rejects a half-surrogate endpoint', () =>
  assert.throws(() => requireBoundary(first, 3))
)
check('Native boundary validation rejects an oversized offset', () =>
  assert.throws(() => requireBoundary(first, 100))
)
const escapedNode = chapter.getElementById('p,2').firstChild
const escapedRange = chapter.createRange()
escapedRange.setStart(escapedNode, 0)
escapedRange.setEnd(escapedNode, 0)
const escaped = cfi.fromRange(escapedRange)
check('Source serializer escapes commas inside ID assertions', () =>
  assert.equal(escaped, 'epubcfi(/4/4[p^,2]/1:0)')
)
check('Escaped assertion still resolves the same text node', () =>
  assert.equal(cfi.toRange(chapter, cfi.parse(escaped)).startContainer, escapedNode)
)
const chunk = chapter.getElementById('chunks')
const chunkRange = chapter.createRange()
chunkRange.setStart(chunk.childNodes[1], 0)
chunkRange.setEnd(chunk.childNodes[2], 1)
const chunkCfi = cfi.fromRange(chunkRange)
const chunkRestored = cfi.toRange(chapter, cfi.parse(chunkCfi))
check('Adjacent text and CDATA share a logical CFI text chunk', () => {
  assert.equal(cfi.collapse(chunkCfi), 'epubcfi(/4/6[chunks]/1:1)')
  assert.equal(cfi.collapse(chunkCfi, true), 'epubcfi(/4/6[chunks]/1:3)')
  assert.equal(chunkRestored.endContainer, chunk.childNodes[2])
  assert.equal(chunkRestored.endOffset, 1)
})
check('Repeated quote does not require first-match searching', () =>
  assert.notEqual(first, chapter.getElementsByTagName('p')[3].firstChild)
)
check('Source fixed-page address is explicitly synthetic', () =>
  assert.equal(cfi.fake.fromIndex(1), 'epubcfi(/6/4)')
)
check('Synthetic fixed-page index remains zero based', () =>
  assert.equal(cfi.fake.toIndex(cfi.parse('epubcfi(/6/4)')[0]), 1)
)
const fixedArchive = unzipSync(await readFile(new URL('fixtures/library/file/fixed.epub', root)))
const fixedPackage = document(strFromU8(fixedArchive['EPUB/package.opf']))
check('Fixed EPUB has a real package layout declaration', () =>
  assert.equal(
    Array.from(fixedPackage.getElementsByTagName('meta')).find(
      (node) => node.getAttribute('property') === 'rendition:layout'
    ).textContent,
    'pre-paginated'
  )
)
check('Fixed EPUB page base resolves to its actual second spine item', () =>
  assert.equal(
    cfi.toElement(fixedPackage, cfi.parse('epubcfi(/6/4[spine-two])')[0]).getAttribute('idref'),
    'c2'
  )
)
const finalArchiveBytes = await readFile(new URL('fixtures/library/file/novel.epub', root))
check('Source archive bytes were not changed', () =>
  assert.equal(
    createHash('sha256').update(finalArchiveBytes).digest('hex'),
    createHash('sha256').update(archiveBytes).digest('hex')
  )
)
const result = {
  evidenceClass: 'pinned-cfi-data-module-and-synthetic-dom-probe',
  sourceModule: receipt.url,
  sourceSha256: receipt.sha256,
  executedPinnedDataModule: true,
  sourceApplicationExecuted: false,
  productionReaderExecuted: false,
  dom: '@xmldom/xmldom 0.8.11 with a bounded Range endpoint model',
  passed: checks.length,
  failed: 0,
  checks,
  anchors: { full, nativeStart, nativeEnd },
  limits: [
    'No real browser Range or rendered selection test.',
    'No source application or Kana jump.',
    'These unchanged synthetic source trees do not prove arbitrary injected or translated DOM compatibility.',
    'The source parser is not a production untrusted-input validator.'
  ]
}
await writeFile(
  fileURLToPath(new URL('cfi-results.json', root)),
  JSON.stringify(result, null, 2) + '\n'
)
console.log(JSON.stringify({ passed: result.passed, failed: result.failed, range: full }))
