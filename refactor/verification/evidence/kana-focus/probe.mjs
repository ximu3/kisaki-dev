// Keep one document's semantic identity while its visual slot follows source targets.
const text = '春の風が窓から入り、書架の物語を静かにめくった。'
const source = `<h1>Example chapter</h1>
<p><a id="first" href="#first">First reference</a>${text.repeat(5)}</p>
<p>${text.repeat(9)}<a id="second" href="#second">Second reference</a>${text.repeat(5)}</p>
<p>${text.repeat(8)}<a id="third" href="#third">Third reference</a>${text.repeat(3)}</p>`
const stage = document.querySelector('#stage')
let views = []
let mode
let logicalSelection = null
let pointer = null
let pendingPointerClick = null
let activeSource = null
let events = []
let actions = []
let mirrorFocusEvents = 0
let canonicalIdentity

function textIndex(doc) {
  const walker = doc.createTreeWalker(doc.getElementById('flow'), NodeFilter.SHOW_TEXT)
  const entries = []
  let length = 0
  while (walker.nextNode()) {
    const node = walker.currentNode
    entries.push({ node, start: length })
    length += node.length
  }
  return {
    text: entries.map(({ node }) => node.data).join(''),
    toSource(node, offset) {
      const entry = entries.find((item) => item.node === node)
      return entry ? entry.start + offset : null
    },
    toDom(offset) {
      const entry =
        entries.find((item) => offset < item.start + item.node.length) ??
        (offset === length ? entries.at(-1) : null)
      if (!entry) throw new Error('The controlled source offset is unavailable.')
      return { node: entry.node, offset: offset - entry.start }
    }
  }
}

function rangeAt(view, offset) {
  const point = view.index.toDom(offset)
  const range = view.doc.createRange()
  range.setStart(point.node, point.offset)
  range.setEnd(point.node, Math.min(point.node.length, point.offset + 1))
  return range
}

function pageAt(view, rect) {
  const scroll = view.doc.scrollingElement
  return Math.max(
    0,
    Math.floor(
      ((mode === 'horizontal-tb' ? rect.left + scroll.scrollLeft : rect.top + scroll.scrollTop) +
        0.1) /
        (mode === 'horizontal-tb' ? 300 : 420)
    )
  )
}

function move(view, page, slot) {
  view.page = page
  view.slot = slot
  view.frame.style.left = (mode === 'vertical-rl' ? 1 - slot : slot) * 300 + 'px'
  if (mode === 'horizontal-tb') view.doc.scrollingElement.scrollLeft = page * 300
  else view.doc.scrollingElement.scrollTop = page * 420
}

function showPage(page) {
  const start = Math.floor(page / 2) * 2
  const slot = page % 2
  move(views[0], page, slot)
  move(views[1], start + 1 - slot, 1 - slot)
}

function showSource(offset) {
  activeSource = offset
  showPage(pageAt(views[0], rangeAt(views[0], offset).getBoundingClientRect()))
}

function projectSelection() {
  const anchor = views[0].index.toDom(logicalSelection.anchor)
  const focus = views[0].index.toDom(logicalSelection.focus)
  views[0].doc.getSelection().setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset)
}

function pointInView(view, x, y) {
  const rect = view.frame.getBoundingClientRect()
  return { x: x - rect.left, y: y - rect.top }
}

function hitAt(x, y) {
  for (const view of views) {
    const local = pointInView(view, x, y)
    if (local.x < 0 || local.x >= 280 || local.y < 0 || local.y >= 400) continue
    const caret = view.doc.caretPositionFromPoint(local.x, local.y)
    if (!caret) return null
    const offset = view.index.toSource(caret.offsetNode, caret.offset)
    if (offset === null) return null
    const anchor = view.doc.elementFromPoint(local.x, local.y)?.closest('a')
    return { offset, link: anchor?.id ?? null }
  }
  return null
}

function topPoint(view, event) {
  const rect = view.frame.getBoundingClientRect()
  return { x: rect.left + event.clientX, y: rect.top + event.clientY }
}

function bind(view, manageTab) {
  view.doc.addEventListener('focusin', (event) => {
    if (view !== views[0]) {
      mirrorFocusEvents++
      return
    }
    const element = view.doc.activeElement
    if (element.matches('a')) {
      const offset = view.index.toSource(element.firstChild, 0)
      events.push({ type: 'focus', trusted: event.isTrusted, source: element.id, view: view.name })
      showSource(offset)
    }
  })
  view.doc.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    const point = topPoint(view, event)
    const hit = hitAt(point.x, point.y)
    if (!hit) return
    event.preventDefault()
    pendingPointerClick = null
    view.doc.documentElement.setPointerCapture(event.pointerId)
    pointer = {
      id: event.pointerId,
      start: point,
      link: hit.link,
      anchor: hit.offset,
      moved: false
    }
    showSource(hit.offset)
    views[0].frame.focus({ preventScroll: true })
    if (hit.link) {
      views[0].doc.getElementById(hit.link).focus({ preventScroll: true })
    } else {
      logicalSelection = { anchor: hit.offset, focus: hit.offset }
      projectSelection()
    }
    events.push({
      type: 'down',
      trusted: event.isTrusted,
      view: view.name,
      sourceLink: hit.link,
      canonicalFocus: views[0].doc.activeElement.id,
      outerFocus: document.activeElement.id
    })
  })
  view.doc.addEventListener('pointermove', (event) => {
    if (!pointer || pointer.id !== event.pointerId) return
    const point = topPoint(view, event)
    pointer.moved ||= Math.hypot(point.x - pointer.start.x, point.y - pointer.start.y) > 4
    if (!pointer.moved) return
    const hit = hitAt(point.x, point.y)
    if (!hit) return
    logicalSelection = { anchor: pointer.anchor, focus: hit.offset }
    showSource(hit.offset)
    projectSelection()
    events.push({ type: 'move', trusted: event.isTrusted, view: view.name })
  })
  view.doc.addEventListener('pointerup', (event) => {
    if (!pointer || pointer.id !== event.pointerId) return
    if (!pointer.moved && pointer.link)
      actions.push({ source: pointer.link, trusted: event.isTrusted })
    pendingPointerClick = { id: event.pointerId }
    pointer = null
    events.push({ type: 'up', trusted: event.isTrusted, view: view.name })
  })
  view.doc.addEventListener('pointercancel', () => {
    pointer = null
    pendingPointerClick = null
  })
  view.doc.addEventListener('click', (event) => {
    events.push({
      type: 'click',
      trusted: event.isTrusted,
      detail: event.detail,
      pointerId: event.pointerId ?? null,
      pointerType: event.pointerType ?? null,
      target: event.target.id || event.target.tagName
    })
    const link = event.target.closest?.('a')
    if (link) event.preventDefault()
    const handledPointer = pendingPointerClick && event.pointerId === pendingPointerClick.id
    pendingPointerClick = null
    // Consume only the known pointer sequence; keyboard/AT activation does not require detail zero.
    if (!handledPointer && link) actions.push({ source: link.id, trusted: event.isTrusted })
  })
  view.doc.addEventListener('keydown', (event) => {
    pendingPointerClick = null
    if (
      !manageTab ||
      view !== views[0] ||
      event.key !== 'Tab' ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return
    // The controlled source contains three ordinary links; this is not a general focusability parser.
    const targets = [...view.doc.querySelectorAll('a[href]')]
    const current = targets.indexOf(view.doc.activeElement)
    const next =
      current < 0
        ? event.shiftKey
          ? targets.at(-1)
          : targets[0]
        : targets[current + (event.shiftKey ? -1 : 1)]
    if (!next) return
    event.preventDefault()
    const offset = view.index.toSource(next.firstChild, 0)
    showSource(offset)
    view.frame.focus({ preventScroll: true })
    next.focus({ preventScroll: true })
    events.push({ type: 'tab', trusted: event.isTrusted, source: next.id })
  })
}

async function setup(writingMode, manageTab = true) {
  stage.replaceChildren()
  mode = writingMode
  logicalSelection = null
  pointer = null
  pendingPointerClick = null
  activeSource = null
  events = []
  actions = []
  mirrorFocusEvents = 0
  views = []
  for (const name of ['canonical', 'mirror']) {
    const frame = document.createElement('iframe')
    frame.id = name
    frame.name = name
    frame.title = name === 'canonical' ? 'Example chapter' : 'Visual chapter copy'
    frame.style.cssText = 'position:absolute;width:280px;height:400px;border:0;top:0'
    frame.sandbox = 'allow-scripts allow-same-origin'
    if (name === 'mirror') {
      frame.setAttribute('aria-hidden', 'true')
      frame.tabIndex = -1
    }
    const ready = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }))
    frame.srcdoc = `<!doctype html><html lang="ja"><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none';script-src 'none';style-src 'unsafe-inline'">
<style>html,body{margin:0;padding:0;writing-mode:${mode};direction:ltr}html{overflow:hidden}
#flow{font:20px/1.5 serif;width:280px;height:400px;column-count:1;column-gap:20px;column-fill:auto}
h1{font-size:24px;margin:0}p{margin:0}a{white-space:nowrap}</style><div id="flow">${source}</div></html>`
    stage.append(frame)
    await ready
    const doc = frame.contentDocument
    views.push({ frame, doc, name, index: textIndex(doc), page: 0, slot: 0 })
  }
  canonicalIdentity = views[0].doc
  for (const view of views) bind(view, manageTab)
  showPage(0)
  return state()
}

function state() {
  const view = views[0]
  const selection = view.doc.getSelection()
  const sameDocument =
    view.doc === canonicalIdentity && view.frame.contentDocument === canonicalIdentity
  const anchor = selection.anchorNode
    ? view.index.toSource(selection.anchorNode, selection.anchorOffset)
    : null
  const focus = selection.focusNode
    ? view.index.toSource(selection.focusNode, selection.focusOffset)
    : null
  const element = view.doc.activeElement
  const bounds = element?.matches('a') ? element.getBoundingClientRect() : null
  return {
    mode,
    sameDocument,
    outerFocus: document.activeElement.id,
    canonicalFocus: element.id,
    mirrorFocus: views[1].doc.activeElement.id,
    focusedLinkVisible: bounds
      ? bounds.right > 0 && bounds.left < 280 && bounds.bottom > 0 && bounds.top < 400
      : null,
    activeSource,
    logicalSelection,
    nativeSelection: { anchor, focus },
    mirrorSelection: views[1].doc.getSelection().toString(),
    mirrorFocusEvents,
    events: [...events],
    actions: [...actions],
    textPreserved: views.every(
      (item) =>
        item.index.text === view.index.text &&
        item.doc.getElementById('flow').textContent === item.index.text
    ),
    slots: views.map((item) => ({
      name: item.name,
      page: item.page,
      slot: item.slot,
      x: item.frame.getBoundingClientRect().left
    }))
  }
}

function pointAt(view, range) {
  const bounds = range.getBoundingClientRect()
  const frameBounds = view.frame.getBoundingClientRect()
  return {
    x: frameBounds.left + (bounds.left + bounds.right) / 2,
    y: frameBounds.top + (bounds.top + bounds.bottom) / 2
  }
}

function linkOnMirror(id) {
  const target = views[0].doc.getElementById(id)
  const page = pageAt(views[0], target.getBoundingClientRect())
  const start = Math.floor(page / 2) * 2
  move(views[0], start + 1 - (page % 2), 1 - (page % 2))
  move(views[1], page, page % 2)
  const range = views[1].doc.createRange()
  range.selectNodeContents(views[1].doc.getElementById(id))
  return pointAt(views[1], range)
}

function dragPoints(reverse) {
  showPage(0)
  const visible = views.map((view) => {
    const result = []
    for (let offset = 0; offset < view.index.text.length; offset++) {
      if (/\s/.test(view.index.text[offset])) continue
      const rect = rangeAt(view, offset).getBoundingClientRect()
      const x = (rect.left + rect.right) / 2,
        y = (rect.top + rect.bottom) / 2
      if (x > 5 && x < 275 && y > 5 && y < 395 && rect.width > 0 && rect.height > 0)
        result.push(offset)
    }
    return result
  })
  const first = visible[0].at(-15),
    second = visible[1][15]
  if (!(first < second)) throw new Error('The controlled adjacent-page range is unavailable.')
  const start = pointAt(views[0], rangeAt(views[0], first))
  const end = pointAt(views[1], rangeAt(views[1], second))
  return reverse
    ? { start: end, end: start, expectedAnchor: second, expectedFocus: first }
    : { start, end, expectedAnchor: first, expectedFocus: second }
}

function reflow() {
  const element = views[0].doc.activeElement
  const id = element.id
  const offset = id ? views[0].index.toSource(element.firstChild, 0) : activeSource
  for (const view of views) {
    view.doc.scrollingElement.scrollLeft = 0
    view.doc.scrollingElement.scrollTop = 0
    view.doc.getElementById('flow').style.fontSize = '26px'
  }
  if (offset !== null) showSource(offset)
  return { ...state(), sameFocusedElement: views[0].doc.activeElement === element }
}

function inertComparison() {
  showPage(0)
  const view = views[1]
  const points = dragPoints(false)
  const local = pointInView(view, points.end.x, points.end.y)
  const read = () => {
    const caret = view.doc.caretPositionFromPoint(local.x, local.y)
    return {
      sourceOffset: caret ? view.index.toSource(caret.offsetNode, caret.offset) : null,
      sourceElementHit: !!view.doc.elementFromPoint(local.x, local.y)?.closest('#flow')
    }
  }
  const hidden = read()
  view.doc.documentElement.inert = true
  const inert = read()
  view.doc.documentElement.inert = false
  return { hidden, inert }
}

window.focusProof = { setup, state, linkOnMirror, dragPoints, reflow, inertComparison }
