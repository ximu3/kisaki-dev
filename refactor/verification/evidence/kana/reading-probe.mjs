// Exercise browser mechanisms; this is not a Kana implementation.
import * as pdfjs from '/pdf/build/pdf.mjs'
import { Reader, ZipReader, TextWriter } from '/zip/index.js'

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve))
const checks = {}
const sourceTexts = ['Chapter one: 甲乙😀丙丁 and ruby.', 'Chapter two: 戊己庚辛 and final text.']
const frames = []
const sourceNodes = []
const liveNodes = []
const violations = []
const imageUrl = URL.createObjectURL(
  new Blob(
    [
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="blue"/></svg>'
    ],
    { type: 'image/svg+xml' }
  )
)
let active = false
let selected = null
let pointerMoves = 0
let pointerCapture = false

function locate(event, owner) {
  const bounds = owner.getBoundingClientRect()
  const x = event.clientX + bounds.left
  const y = event.clientY + bounds.top
  const target = frames.find((item) => {
    const r = item.getBoundingClientRect()
    return x >= r.left && x < r.right && y >= r.top && y < r.bottom
  })
  if (!target) return null
  const r = target.getBoundingClientRect()
  const doc = target.contentDocument
  const caret = doc.caretPositionFromPoint(x - r.left, y - r.top)
  if (!caret || !liveNodes.includes(caret.offsetNode)) return null
  return { chapter: frames.indexOf(target), offset: caret.offset }
}

function quote(selection) {
  const { start, end } = selection
  if (start.chapter === end.chapter)
    return sourceTexts[start.chapter].slice(start.offset, end.offset)
  return sourceTexts
    .slice(start.chapter, end.chapter + 1)
    .map((text, index, all) =>
      index === 0
        ? text.slice(start.offset)
        : index === all.length - 1
          ? text.slice(0, end.offset)
          : text
    )
    .join('\n')
}

function project(selection) {
  return frames.map((item, chapter) => {
    const doc = item.contentDocument
    const range = doc.createRange()
    range.setStart(
      liveNodes[chapter],
      chapter === selection.start.chapter ? selection.start.offset : 0
    )
    range.setEnd(
      liveNodes[chapter],
      chapter === selection.end.chapter ? selection.end.offset : sourceTexts[chapter].length
    )
    const highlight = new item.contentWindow.Highlight(range)
    item.contentWindow.CSS.highlights.set('kana-probe', highlight)
    return {
      range,
      rects: [...range.getClientRects()].map((r) => ({
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height
      }))
    }
  })
}

for (let i = 0; i < sourceTexts.length; i++) {
  const source = new DOMParser().parseFromString(
    `<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><p>${sourceTexts[i]}</p></body></html>`,
    'application/xhtml+xml'
  )
  sourceNodes.push(source.querySelector('p').firstChild)
  const item = document.createElement('iframe')
  item.sandbox = 'allow-same-origin'
  const loaded = new Promise((resolve) => item.addEventListener('load', resolve, { once: true }))
  // Deliberately retain hostile nodes to exercise the browser's second barrier.
  // Production must also parse/filter markup, CSS, paths and resource references.
  item.srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src blob:; font-src blob:; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'"><style>@import url(https://kana-probe.invalid/style.css);@font-face{font-family:ProbeRemote;src:url(https://kana-probe.invalid/font.woff2)}body{margin:12px;font:22px/1.8 ProbeRemote,sans-serif}#host{display:none}::highlight(kana-probe){background:#f6de8b}</style><body onload="parent.kanaEscaped=true"><p>${sourceTexts[i]}</p><script>parent.kanaEscaped=true<\/script><img src="https://kana-probe.invalid/image.png" onerror="parent.kanaEscaped=true"><img class="allowed" src="${imageUrl}"><a href="https://kana-probe.invalid/link">external</a>`
  document.querySelector('#chapters').append(item)
  await loaded
  frames.push(item)
  const doc = item.contentDocument
  liveNodes.push(doc.querySelector('p').firstChild)
  doc.addEventListener('securitypolicyviolation', (event) =>
    violations.push(event.violatedDirective)
  )
  doc.addEventListener('pointerdown', (event) => {
    const start = locate(event, item)
    if (!start) return
    selected = { start, end: start }
    active = true
    doc.documentElement.setPointerCapture(event.pointerId)
    pointerCapture = doc.documentElement.hasPointerCapture(event.pointerId)
    event.preventDefault()
  })
  doc.addEventListener('pointermove', (event) => {
    if (!active) return
    pointerMoves++
    const end = locate(event, item)
    if (end) selected.end = end
  })
  doc.addEventListener('pointerup', () => {
    active = false
  })
  doc.addEventListener('click', (event) => {
    if (event.target.closest('a')) event.preventDefault()
  })
}

await frame()
assert(!globalThis.kanaEscaped, 'Book script or event attribute executed')
assert(getComputedStyle(document.querySelector('#host')).display !== 'none', 'Book CSS escaped')
assert(
  frames.every((item) => item.contentDocument.querySelector('.allowed').naturalWidth === 10),
  'Authorized image failed to load'
)
checks.isolation = {
  sameOriginInspection: true,
  bookScriptsBlocked: true,
  hostStyleUnaffected: true,
  authorizedImageLoaded: true,
  productionSanitizerTested: false
}
const cross = document.createRange()
cross.setStart(liveNodes[0], 4)
cross.setEnd(liveNodes[1], 8)
checks.nativeCrossDocumentRange = {
  collapsed: cross.collapsed,
  startsInSecondDocument: cross.startContainer === liveNodes[1]
}
assert(cross.collapsed, 'Expected native cross-document range to collapse')

function pointerPoint(chapter, offset) {
  const item = frames[chapter]
  const range = item.contentDocument.createRange()
  range.setStart(liveNodes[chapter], offset)
  range.setEnd(liveNodes[chapter], offset + 1)
  const r = range.getBoundingClientRect()
  const outer = item.getBoundingClientRect()
  return { x: Math.round(outer.left + r.left + 1), y: Math.round(outer.top + r.top + r.height / 2) }
}
globalThis.pointerPlan = { start: pointerPoint(0, 5), end: pointerPoint(1, 16) }
globalThis.finishReadingProbe = async () => {
  assert(
    selected?.start.chapter === 0 && selected?.end.chapter === 1,
    'Real pointer drag did not cross the chapter boundary'
  )
  assert(pointerCapture && pointerMoves > 0, 'Pointer capture did not continue')
  const before = project(selected)
  const saved = JSON.parse(JSON.stringify(selected))
  const text = quote(selected)
  frames[0].style.width = '250px'
  frames[0].contentDocument.body.style.fontSize = '29px'
  frames[1].contentDocument.body.style.writingMode = 'vertical-rl'
  frames[1].contentDocument.body.style.height = '200px'
  await Promise.all(frames.map((item) => item.contentDocument.fonts.ready))
  await frame()
  const after = project(saved)
  assert(quote(saved) === text, 'Logical selection changed after layout')
  assert(
    after.every(
      (entry) => entry.rects.length && entry.rects.every((r) => r.width > 0 && r.height > 0)
    ),
    'Selection geometry is empty'
  )
  assert(
    JSON.stringify(before.map((v) => v.rects)) !== JSON.stringify(after.map((v) => v.rects)),
    'Geometry did not change after layout'
  )
  checks.selection = {
    realPointerCrossedFrames: true,
    pointerCapture,
    pointerMoves,
    sourceOffsets: saved,
    quote: text,
    localHighlightCount: after.length,
    geometryChanged: true,
    sourceUnchanged: sourceNodes.every((n, i) => n.data === sourceTexts[i]),
    verticalLayout: getComputedStyle(frames[1].contentDocument.body).writingMode,
    keyboardAutoscrollClipboardAndReopenTested: false,
    standardCfiRoundTripTested: false
  }

  const requests = []
  const read = async (path, begin, end, signal) => {
    requests.push({ path, begin, end })
    const res = await fetch(path, { headers: { Range: `bytes=${begin}-${end - 1}` }, signal })
    assert(res.status === 206, 'Range source did not return partial bytes')
    const bytes = new Uint8Array(await res.arrayBuffer())
    assert(bytes.length === end - begin, 'Range source returned an incorrect length')
    return bytes
  }
  const manifest = await (await fetch('/fixtures.json')).json()
  class RangeSource extends Reader {
    constructor() {
      super()
      this.size = manifest.zipSize
    }
    readUint8Array(offset, length) {
      return read('/bytes/large.zip', offset, offset + length)
    }
  }
  const zip = new ZipReader(new RangeSource(), { useWebWorkers: false })
  const entries = await zip.getEntries()
  const member = await entries
    .find((entry) => entry.filename === 'chapter.xhtml')
    .getData(new TextWriter())
  await zip.close()
  assert(member.includes('Kana ZIP range fixture'), 'ZIP member content is incorrect')
  const zipRequests = requests.filter((r) => r.path.endsWith('.zip'))
  const zipReadBytes = zipRequests.reduce((sum, r) => sum + r.end - r.begin, 0)
  assert(zipReadBytes < manifest.zipSize / 10, 'ZIP unnecessarily read the whole archive')
  checks.zip = {
    version: '2.24.0',
    inputBytes: manifest.zipSize,
    readBytes: zipReadBytes,
    requests: zipRequests.length,
    memberDecoded: true
  }

  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf/build/pdf.worker.mjs'
  const abortController = new AbortController()
  let aborted = false
  class Transport extends pdfjs.PDFDataRangeTransport {
    constructor() {
      super(manifest.pdfSize, new Uint8Array(), true)
    }
    requestDataRange(begin, end) {
      read('/bytes/doc.pdf', begin, end, abortController.signal)
        .then((bytes) => {
          if (!aborted) this.onDataRange(begin, bytes)
        })
        .catch((error) => {
          if (!aborted) globalThis.probeError = error.message
        })
    }
    abort() {
      aborted = true
      abortController.abort()
    }
  }
  const task = pdfjs.getDocument({
    range: new Transport(),
    disableStream: true,
    disableAutoFetch: true,
    rangeChunkSize: 32768,
    isEvalSupported: false,
    enableXfa: false,
    standardFontDataUrl: '/pdf/standard_fonts/',
    cMapUrl: '/pdf/cmaps/',
    cMapPacked: true,
    wasmUrl: '/pdf/wasm/'
  })
  const pdf = await task.promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 1 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  document.body.append(canvas)
  await page.render({ canvas, viewport }).promise
  const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
  let inkPixels = 0
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] > 0 && Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) < 200) inkPixels++
  }
  assert(inkPixels > 0, 'PDF rendering produced no visible content')
  const content = await page.getTextContent()
  assert(
    content.items.some((item) => item.str.includes('Kana PDF fixture')),
    'PDF text is missing'
  )
  const point = [75, 120]
  const displayed = viewport.convertToViewportPoint(...point)
  const restored = viewport.convertToPdfPoint(...displayed)
  assert(
    restored.every((n, i) => Math.abs(n - point[i]) < 1e-6),
    'PDF viewport roundtrip failed'
  )
  await task.destroy()
  assert(aborted, 'PDF destroy did not close the range transport')
  const pdfRequests = requests.filter((r) => r.path.endsWith('.pdf'))
  const pdfReadBytes = pdfRequests.reduce((sum, r) => sum + r.end - r.begin, 0)
  assert(pdfReadBytes < manifest.pdfSize / 10, 'PDF unnecessarily read the whole input')
  checks.pdf = {
    version: pdfjs.version,
    workerUsed: true,
    inputBytes: manifest.pdfSize,
    readBytes: pdfReadBytes,
    requests: pdfRequests.length,
    cropBox: page.view,
    userUnit: page.userUnit,
    rotate: page.rotate,
    rendered: true,
    inkPixels,
    textExtracted: true,
    viewportRoundTrip: true,
    transportAbortedOnDestroy: aborted,
    fullTextLayerSelectionAndMemoryLimitTested: false
  }
  frames.forEach((item) => item.remove())
  URL.revokeObjectURL(imageUrl)
  canvas.remove()
  return {
    checks,
    violations,
    scope:
      'Isolated Windows Chromium browser-mechanism proof, not a complete reader or format-conformance test'
  }
}
globalThis.probeReady = true
