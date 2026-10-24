// Observe unchanged upstream behavior and separate its contract from Kana's source-address rules.
import * as CFI from '/upstream/epubcfi.js'
import { EPUB } from '/upstream/epub.js'
import { makeFB2 } from '/upstream/fb2.js'
import { MOBI } from '/upstream/mobi.js'
import { View, makeBook, UnsupportedTypeError } from '/upstream/view.js'

const bytes = async (url) => new Uint8Array(await (await fetch(url)).arrayBuffer())
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
const parser = new DOMParser()

async function inspect() {
  const upstreamTests = { assertions: 0, failed: 0 }
  const previous = console.assert
  try {
    console.assert = (condition) => {
      upstreamTests.assertions++
      if (!condition) upstreamTests.failed++
    }
    await import('/upstream/tests/epubcfi-tests.js')
  } finally {
    console.assert = previous
  }
  assert(upstreamTests.failed === 0, 'An upstream CFI assertion failed')

  const documents = await (await fetch('/epub-documents.json')).json()
  const book = await new EPUB({
    loadText: async (name) => documents[name] ?? null,
    loadBlob: async (name) => (name in documents ? new Blob([documents[name]]) : null),
    getSize: (name) => (name in documents ? new TextEncoder().encode(documents[name]).length : 0)
  }).init()
  const secondOccurrence = book.sections[1].cfi
  const occurrenceResult = book.resolveCFI(secondOccurrence)
  const repeatedSpine = {
    sections: book.sections.length,
    secondOccurrence,
    resolvedIndex: occurrenceResult.index,
    expectedSourceOccurrence: 1,
    contractMatches: occurrenceResult.index === 1
  }
  assert(repeatedSpine.sections === 3, 'The repeated-spine sample was not loaded')
  book.destroy()

  const { default: xmlFactory } = await import('/candidate-build/expat.mjs')
  const { createXmlParser } = await import('/candidate/xml-parser.mjs')
  const strictXml = await createXmlParser(xmlFactory)
  const xhtmlEntities = []
  for (const [name, doctype] of [
    [
      'xhtml11',
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">'
    ],
    [
      'xhtml10',
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">'
    ],
    ['unknown-subset', '<!DOCTYPE html SYSTEM "https://review.invalid/unknown.dtd">'],
    ['no-doctype', '']
  ]) {
    const xml =
      doctype +
      '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Entity fixture</title></head><body><p id="entity">A&nbsp;B&copy;C</p></body></html>'
    const reference = new EPUB({ loadText: async () => xml })
    const document = await reference.loadDocument({
      href: 'chapter.xhtml',
      mediaType: 'application/xhtml+xml'
    })
    const candidate = strictXml.parse(new TextEncoder().encode(xml))
    xhtmlEntities.push({
      name,
      foliateParsed: !document.querySelector('parsererror'),
      foliateText: document.getElementById('entity')?.textContent ?? null,
      expatCandidateParsed: candidate.ok,
      candidateFailure: candidate.failure ?? null,
      candidateNativeError: candidate.nativeError ?? null
    })
  }

  const doc = parser.parseFromString(
    '<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><p id="a">A</p><p id="b">B</p></body></html>',
    'application/xhtml+xml'
  )
  const rebound = CFI.toElement(doc, CFI.parse('/4/2[b]')[0])
  const wrongText = CFI.toRange(doc, CFI.parse('/4/2[a]/1:1[WRONG]'))
  const cfiBehavior = {
    wrongIdResolvedTo: rebound?.id,
    wrongTextAssertionReturnedRange: !!wrongText,
    wrongTextAssertionOffset: wrongText.startOffset,
    leadingZeroParsedIndex: CFI.parse('epubcfi(/04/02[a]/1:01)')[0][0].index,
    temporalZeroAfterSerialization: CFI.collapse('epubcfi(/4/6~0)'),
    temporalComparison: CFI.compare('epubcfi(/4/6~1)', 'epubcfi(/4/6~2)')
  }

  const fb2 = []
  const normalBytes = await bytes('/fixtures/source.fb2')
  const normalText = new TextDecoder().decode(normalBytes)
  const external = normalText
    .replace(
      '<FictionBook ',
      '<!DOCTYPE FictionBook [<!ENTITY outside SYSTEM "https://review.invalid/entity">]>\n<FictionBook '
    )
    .replace(/<p id="merge">[\s\S]*?<\/p>/, '<p id="merge">left&outside;right</p>')
  for (const input of [
    { name: 'normal-utf8', data: normalBytes },
    { name: 'normal-utf16', data: await bytes('/fixtures/source-utf16.fb2') },
    { name: 'internal-entity', data: await bytes('/fixtures/internal-entity.fb2') },
    { name: 'external-entity', data: new TextEncoder().encode(external) }
  ]) {
    let value
    try {
      const fb = await makeFB2(new Blob([input.data]))
      try {
        const page = await fb.sections[0].createDocument()
        const target = page.getElementById('merge')
        const range = page.createRange()
        range.setStart(target.firstChild, 0)
        range.collapse(true)
        value = {
          name: input.name,
          opened: true,
          sections: fb.sections.length,
          location: View.prototype.getCFI.call({ book: fb }, 0, range),
          positionScheme: 'generated-section-cfi',
          sourceXmlNodePathExposed: false,
          observedText: input.name === 'external-entity' ? target.textContent : null
        }
      } finally {
        fb.destroy()
      }
    } catch (error) {
      value = { name: input.name, opened: false, errorType: error.constructor.name }
    }
    fb2.push(value)
  }

  const mobi = []
  for (const name of ['sample-cp1252.mobi', 'sample-ncx.mobi']) {
    const data = await bytes('/mobi/' + name)
    const header = new DataView(data.buffer).getUint32(78)
    const originalVersion = new DataView(data.buffer).getUint32(header + 36)
    const source = new MOBI({})
    const mb = await source.open(new File([data], name))
    try {
      const page = await mb.sections[0].createDocument()
      const walker = page.createTreeWalker(page.body, NodeFilter.SHOW_TEXT)
      let text
      while ((text = walker.nextNode())) if (text.data.trim()) break
      assert(text, 'The MOBI sample has no source text')
      const range = page.createRange()
      range.setStart(text, 0)
      range.collapse(true)
      mobi.push({
        name,
        originalVersion,
        selectedVersion: source.headers.mobi.version,
        sections: mb.sections.length,
        location: View.prototype.getCFI.call({ book: mb }, 0, range),
        sourceByteAnchorExposed: false,
        positionScheme: 'generated-section-cfi'
      })
    } finally {
      mb.destroy()
    }
  }
  let rar
  try {
    await makeBook(new File([await bytes('/fixture.rar')], 'sample.cbr'))
    rar = { supported: true }
  } catch (error) {
    rar = { supported: false, unsupportedType: error instanceof UnsupportedTypeError }
  }
  return {
    upstreamTests,
    repeatedSpine,
    xhtmlEntities,
    cfiBehavior,
    fb2,
    mobi,
    rar,
    upstreamCodeModified: false,
    fullViewRendered: false,
    allObservationAssertionsPassed: true
  }
}
globalThis.reviewPromise = inspect()
