// Isolated mechanisms only; source ids here are fixture ids, not public reading addresses.
const assert = (value, message) => {
  if (!value) throw new Error(message)
}
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve))
const settle = async () => {
  await frame()
  await frame()
}
const viewport = document.querySelector('#viewport')
const clip = document.querySelector('#clip')
const page = document.querySelector('#page')
const overlay = document.querySelector('#overlay')
let sourcePage = 'a.svg'
let matrix = new DOMMatrix()
let generation = 0
let reading = null
let closing = false
let closed = false
let navigationCompleted = false
let closeComplete
const queued = []

const rectValue = (rect) => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height
})
const rectEqual = (a, b) => Object.keys(a).every((key) => Math.abs(a[key] - b[key]) < 0.01)
const invalidate = () => {
  generation++
}
new ResizeObserver(invalidate).observe(viewport)
window.addEventListener('resize', invalidate)
for (const type of ['wheel', 'touchmove', 'pointerdown']) {
  viewport.addEventListener(
    type,
    (event) => {
      if (reading) event.preventDefault()
    },
    { passive: false, capture: true }
  )
}

function projectRegion(region) {
  const box = clip.getBoundingClientRect()
  const points = [
    [region.x, region.y],
    [region.x + region.width, region.y],
    [region.x + region.width, region.y + region.height],
    [region.x, region.y + region.height]
  ].map(([x, y]) => matrix.transformPoint(new DOMPoint(x * 400, y * 300)))
  const left = Math.min(...points.map((point) => point.x)) + box.left
  const top = Math.min(...points.map((point) => point.y)) + box.top
  const right = Math.max(...points.map((point) => point.x)) + box.left
  const bottom = Math.max(...points.map((point) => point.y)) + box.top
  const bounds = viewport.getBoundingClientRect()
  assert(
    left >= box.left - 0.01 &&
      top >= box.top - 0.01 &&
      right <= box.right + 0.01 &&
      bottom <= box.bottom + 0.01,
    'Region is outside the displayed source crop'
  )
  assert(
    left >= bounds.left && top >= bounds.top && right <= bounds.right && bottom <= bounds.bottom,
    'Region is outside the viewport'
  )
  return { left, top, width: right - left, height: bottom - top }
}

async function configure(rotation, scale) {
  assert(!reading && !closed, 'Cannot configure during a read')
  sourcePage = 'a.svg'
  navigationCompleted = false
  document.querySelector('#target').setAttribute('fill', '#c62828')
  const translations = { 0: [0, 0], 90: [240, 0], 180: [320, 240], 270: [0, 320] }
  const [x, y] = translations[rotation]
  matrix = new DOMMatrix().scale(scale).translate(x, y).rotate(rotation).translate(-40, -30)
  page.style.transform = matrix.toString()
  clip.style.width = `${(rotation % 180 ? 240 : 320) * scale}px`
  clip.style.height = `${(rotation % 180 ? 320 : 240) * scale}px`
  generation++
  await settle()
  const region = { x: 0.25, y: 0.25, width: 0.15, height: 0.15 }
  const mapped = projectRegion(region)
  const actual = rectValue(document.querySelector('#target').getBoundingClientRect())
  assert(rectEqual(mapped, actual), 'Canonical region did not match actual browser geometry')
  const point = new DOMPoint(163, 127)
  const recovered = matrix.inverse().transformPoint(matrix.transformPoint(point))
  const inverseError = Math.max(Math.abs(recovered.x - point.x), Math.abs(recovered.y - point.y))
  assert(inverseError < 1e-4, 'Page transform exceeded the measured subpixel tolerance')
  return { rotation, scale, mapped, actual, inverseError }
}

async function beginRead(target = 'region') {
  assert(!reading && !closing && !closed, 'View is not available')
  const acceptedGeneration = generation
  reading = { generation, sourcePage, preparing: true }
  try {
    await settle()
    const region =
      target === 'outside'
        ? { x: 0, y: 0, width: 0.1, height: 0.1 }
        : { x: 0.25, y: 0.25, width: 0.15, height: 0.15 }
    const rect =
      target === 'viewport' ? rectValue(viewport.getBoundingClientRect()) : projectRegion(region)
    overlay.style.visibility = 'hidden'
    await settle()
    assert(!closing && generation === acceptedGeneration, 'View changed while preparing the read')
    reading = {
      generation,
      sourcePage,
      rect,
      viewport: rectValue(viewport.getBoundingClientRect()),
      dpr: devicePixelRatio
    }
    return { ...reading, target, region: target === 'viewport' ? null : region }
  } catch (error) {
    reading = null
    overlay.style.visibility = ''
    if (closing) {
      queued.length = 0
      closed = true
      closeComplete?.()
    } else for (const operation of queued.splice(0)) operation()
    throw error
  }
}

function navigate() {
  const apply = () => {
    sourcePage = 'b.svg'
    document.querySelector('#target').setAttribute('fill', '#243dcc')
    navigationCompleted = true
    generation++
  }
  if (reading) queued.push(apply)
  else apply()
}

async function finishRead() {
  assert(reading, 'No active view read')
  await settle()
  const accepted =
    !closing &&
    generation === reading.generation &&
    sourcePage === reading.sourcePage &&
    devicePixelRatio === reading.dpr &&
    rectEqual(reading.viewport, rectValue(viewport.getBoundingClientRect()))
  const cause = closing ? 'closed' : accepted ? null : 'viewChanged'
  reading = null
  overlay.style.visibility = ''
  if (closing) {
    queued.length = 0
    closed = true
    closeComplete?.()
  } else {
    for (const operation of queued.splice(0)) operation()
  }
  await settle()
  return { accepted, cause, sourcePage, navigationCompleted, closed }
}

function startClose() {
  closing = true
  generation++
  globalThis.closePromise = new Promise((resolve) => {
    closeComplete = resolve
  })
  globalThis.closePromise.then(() => {
    globalThis.closeResolved = true
  })
  if (!reading) {
    closed = true
    closeComplete()
  }
}

async function textProof() {
  const content = document.querySelector('#text')
  const loaded = new Promise((resolve) => content.addEventListener('load', resolve, { once: true }))
  content.srcdoc = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>body{font:20px/1.5 serif}.pre{white-space:pre-wrap}.hidden{display:none}#upper{text-transform:uppercase}</style><p id="normal">Alpha   <span>Beta</span>\nGamma</p><p id="cjk" lang="zh">你好\n世界</p><p id="ruby"><ruby>漢<rt>かん</rt>字<rt>じ</rt></ruby></p><p id="hidden">one<span class="hidden">secret</span>two</p><p id="upper">Straße</p><p id="pre" class="pre"> A  B\n  C </p>`
  await loaded
  const doc = content.contentDocument
  const observations = {}
  for (const id of ['normal', 'cjk', 'ruby', 'hidden', 'upper', 'pre']) {
    const element = doc.getElementById(id)
    const range = doc.createRange()
    range.selectNodeContents(element)
    const selection = content.contentWindow.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    observations[id] = {
      source: element.textContent,
      innerText: element.innerText,
      selected: selection.toString()
    }
  }
  const folding = await (await fetch('/casefold.json')).json()
  const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })
  const fold = (text) =>
    Array.from(
      text,
      (character) =>
        folding.map[character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')] ??
        character
    )
      .join('')
      .normalize('NFC')
  function indexRuns(runs) {
    const text = runs.map((run) => run.text).join('')
    const source = []
    for (const run of runs)
      for (let offset = 0; offset < run.text.length; offset++) source.push({ node: run.id, offset })
    let transformed = ''
    const boundaries = []
    for (const { segment, index } of segmenter.segment(text)) {
      const output = fold(segment)
      for (let i = 0; i < output.length; i++)
        boundaries.push({
          start: source[index],
          end: {
            node: source[index + segment.length - 1].node,
            offset: source[index + segment.length - 1].offset + 1
          }
        })
      transformed += output
    }
    return { transformed, boundaries }
  }
  function search(runs, query) {
    const { transformed, boundaries } = indexRuns(runs)
    const needle = fold(query)
    const found = new Map()
    for (
      let offset = transformed.indexOf(needle);
      offset >= 0;
      offset = transformed.indexOf(needle, offset + 1)
    ) {
      const hit = {
        start: boundaries[offset].start,
        end: boundaries[offset + needle.length - 1].end
      }
      found.set(JSON.stringify(hit), hit)
    }
    return [...found.values()]
  }
  const cases = [
    {
      runs: [{ id: 'a', text: 'Straße' }],
      query: 'STRASSE',
      expected: [{ start: { node: 'a', offset: 0 }, end: { node: 'a', offset: 6 } }]
    },
    {
      runs: [
        { id: 'a', text: 'Cafe' },
        { id: 'b', text: '\u0301 noir' }
      ],
      query: 'CAFÉ',
      expected: [{ start: { node: 'a', offset: 0 }, end: { node: 'b', offset: 1 } }]
    },
    {
      runs: [{ id: 'a', text: '甲😀乙' }],
      query: '😀',
      expected: [{ start: { node: 'a', offset: 1 }, end: { node: 'a', offset: 3 } }]
    },
    {
      runs: [{ id: 'a', text: 'ß' }],
      query: 's',
      expected: [{ start: { node: 'a', offset: 0 }, end: { node: 'a', offset: 1 } }]
    },
    { runs: [{ id: 'a', text: 'Ａ' }], query: 'A', expected: [] },
    { runs: [{ id: 'a', text: 'é' }], query: 'e', expected: [] },
    {
      runs: [{ id: 'a', text: 'ς' }],
      query: 'Σ',
      expected: [{ start: { node: 'a', offset: 0 }, end: { node: 'a', offset: 1 } }]
    }
  ]
  for (const entry of cases)
    assert(
      JSON.stringify(search(entry.runs, entry.query)) === JSON.stringify(entry.expected),
      `Search source mapping failed: ${entry.query}`
    )
  return {
    observations,
    caseFoldingVersion: folding.unicodeVersion,
    mappedSearchCases: cases.length,
    standardSourceAddressesTested: false,
    fullTextProjectionImplemented: false
  }
}

globalThis.probe = {
  configure,
  beginRead,
  finishRead,
  navigate,
  startClose,
  status: () => ({ sourcePage, navigationCompleted, closed, reading: !!reading })
}
globalThis.textResult = await textProof()
globalThis.probeReady = true
