// Compare browser mechanisms without interpreting engine observations as complete product support.
const policy =
  "default-src 'none'; script-src 'none'; style-src blob: 'unsafe-inline'; img-src blob: data:; font-src blob: data:; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'"
const rectangles = (element) => {
  const { x, y, width, height } = element.getBoundingClientRect()
  return { x, y, width, height }
}
let currentFrame = null
const mountedFrames = new Set()
const resourceUrls = new Set()
let events = []
let engineName = ''

const clear = () => {
  for (const frame of mountedFrames) frame.remove()
  mountedFrames.clear()
  currentFrame = null
  document.getElementById('stage').removeAttribute('style')
  for (const url of resourceUrls) URL.revokeObjectURL(url)
  resourceUrls.clear()
}
const provideBlob = (parts, type) => {
  const url = URL.createObjectURL(new Blob(parts, { type }))
  resourceUrls.add(url)
  return url
}
const mount = async ({
  styles = '',
  content = '',
  rootStyle = '',
  allowScripts = true,
  width = 580,
  height = 400,
  replace = true
}) => {
  if (replace) clear()
  const frame = document.createElement('iframe')
  frame.dataset.probe = 'content'
  frame.sandbox = allowScripts ? 'allow-same-origin allow-scripts' : 'allow-same-origin'
  frame.style.cssText = `display:block;border:0;width:${width}px;height:${height}px`
  const ready = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }))
  frame.srcdoc = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><style>html,body{margin:0}html{${rootStyle}}p{margin:0}${styles}</style>${content}`
  document.getElementById('stage').append(frame)
  mountedFrames.add(frame)
  currentFrame = frame
  await ready
  return frame
}

async function prepareEvents(allowScripts) {
  events = []
  window.bookExecutionCount = 0
  const frame = await mount({
    allowScripts,
    styles:
      'body{background:rgb(220,230,240);font:20px/1.5 serif}button,a{display:block;margin:24px}#target{margin-top:100px}',
    content: `<script>parent.bookExecutionCount += 1</script><script src="/book-script.js?engine=${engineName}"></script>
      <button type="button" id="action" onclick="parent.bookExecutionCount += 100">Probe action</button>
      <a href="#target" id="reference">Follow reference</a>
      <img id="blocked-image" src="/outside.png?engine=${engineName}" onerror="parent.bookExecutionCount += 1000">
      <img id="provided-image" alt="Provided diagram"><p id="target">Readable book text</p>`
  })
  const doc = frame.contentDocument
  doc.addEventListener('pointerdown', (event) => {
    events.push({ type: 'pointerdown', target: event.target.id, trusted: event.isTrusted })
  })
  doc.addEventListener('click', (event) => {
    events.push({ type: 'click', target: event.target.id, trusted: event.isTrusted })
    if (event.target.closest('a')) event.preventDefault()
  })
  const resourceUrl = provideBlob(
    [
      '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="navy"/></svg>'
    ],
    'image/svg+xml'
  )
  const image = doc.getElementById('provided-image')
  image.src = resourceUrl
  await image.decode()
  const stylesheet = doc.createElement('link')
  stylesheet.rel = 'stylesheet'
  stylesheet.href = provideBlob(['body { --provided-style: loaded; }'], 'text/css')
  doc.head.append(stylesheet)
  const deadline = performance.now() + 3000
  while (
    frame.contentWindow.getComputedStyle(doc.body).getPropertyValue('--provided-style').trim() !==
    'loaded'
  ) {
    if (performance.now() > deadline) throw new Error('The provided stylesheet did not load.')
    await new Promise((resolve) => setTimeout(resolve, 16))
  }
  return {
    sourceText: doc.getElementById('target').textContent,
    providedImageWidth: image.naturalWidth,
    providedStylesheetLoaded: true
  }
}

const eventResult = () => ({
  events: [...events],
  bookExecutionCount: window.bookExecutionCount,
  hostBackground: getComputedStyle(document.body).backgroundColor,
  nodeAvailableInContent: typeof currentFrame.contentWindow.process !== 'undefined'
})

const configurations = [
  {
    name: 'horizontal-native',
    mode: 'horizontal-tb',
    css: 'width:580px;height:400px;column-count:2;column-gap:20px;column-fill:auto;'
  },
  ...['vertical-rl', 'vertical-lr'].flatMap((mode) => [
    {
      name: mode + '-ordinary',
      mode,
      css: 'width:580px;height:400px;column-count:1;column-gap:20px;column-fill:auto;'
    },
    {
      name: mode + '-wrapped',
      mode,
      css: 'width:580px;height:400px;column-count:1;column-height:280px;column-wrap:wrap;gap:20px;column-fill:auto;'
    },
    {
      name: mode + '-nested-fixed',
      mode,
      nested: true,
      css: 'width:280px;height:400px;column-count:1;column-gap:0;column-fill:auto;'
    },
    {
      name: mode + '-nested-auto',
      mode,
      nested: true,
      css: 'width:280px;height:auto;column-width:400px;column-count:1;column-gap:0;column-fill:auto;'
    },
    ...['normal', 'reversed'].map((progression) => ({
      name: mode + '-webkit-' + progression,
      mode,
      webkit: true,
      css: `width:280px;height:400px;-webkit-column-axis:horizontal;-webkit-column-progression:${progression};column-gap:20px;column-fill:auto;`
    }))
  ])
]

const markup =
  '<p id="first">最初のページ</p><p id="second">次のページ</p><p id="third">最後のページ</p>'
function layoutInput(item, content) {
  const writing = `writing-mode:${item.mode};font:20px/1.5 serif;`
  if (item.webkit)
    return {
      rootStyle: writing + item.css,
      styles: '#second,#third{break-before:column;-webkit-column-break-before:always}',
      content
    }
  if (item.nested)
    return {
      styles: `#outer{writing-mode:horizontal-tb;direction:${item.mode === 'vertical-rl' ? 'rtl' : 'ltr'};width:580px;height:400px;column-count:2;column-gap:20px;column-fill:auto}#flow{direction:ltr;${writing}${item.css}}#second,#third{break-before:column}`,
      content: `<div id="outer"><div id="flow">${content}</div></div>`
    }
  return {
    rootStyle: `writing-mode:${item.mode}`,
    styles: `#flow{${writing}${item.css}}#second,#third{break-before:column}`,
    content: `<div id="flow">${content}</div>`
  }
}

async function layoutResults() {
  const result = []
  for (const item of configurations) {
    const frame = await mount(layoutInput(item, markup))
    const doc = frame.contentDocument
    const first = rectangles(doc.getElementById('first'))
    const second = rectangles(doc.getElementById('second'))
    const third = rectangles(doc.getElementById('third'))
    const dx = second.x - first.x,
      dy = second.y - first.y
    const expectedSign = item.mode === 'vertical-rl' ? -1 : 1
    const physicalSideBySide =
      Math.abs(dy) < 1 && Math.abs(dx) > 200 && Math.sign(dx) === expectedSign
    let naturalFlow = null
    {
      const source = '春の風が窓から入る。書架には古い物語が並び、遠くで列車の音がした。'.repeat(24)
      const naturalFrame = await mount(layoutInput(item, '<p id="natural">' + source + '</p>'))
      const naturalDoc = naturalFrame.contentDocument,
        node = naturalDoc.getElementById('natural').firstChild
      const positions = []
      for (let offset = 0; offset < node.length; offset++) {
        const range = naturalDoc.createRange()
        range.setStart(node, offset)
        range.setEnd(node, offset + 1)
        const bounds = range.getBoundingClientRect()
        positions.push({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height })
      }
      const anchor =
        item.mode === 'vertical-rl' ? positions[0].x + positions[0].width : positions[0].x
      const offsets = positions.map(
        (value) =>
          expectedSign * ((item.mode === 'vertical-rl' ? value.x + value.width : value.x) - anchor)
      )
      const pageIndexes = offsets.map((value) => Math.max(0, Math.floor((value + 0.2) / 300)))
      const gutterViolations = offsets.filter((value, index) => {
        const within = (((value + 0.2) % 300) + 300) % 300
        return within + positions[index].width > 280.5
      }).length
      naturalFlow = {
        characters: node.length,
        sourceUnchanged: node.nodeValue === source,
        allGlyphsHaveGeometry: positions.every((value) => value.width > 0 && value.height > 0),
        pageIndexesNondecreasing: pageIndexes.every(
          (value, index) => index === 0 || value >= pageIndexes[index - 1]
        ),
        pages: Math.max(...pageIndexes) + 1,
        gutterViolations,
        yExtent: [
          Math.min(...positions.map((value) => value.y)),
          Math.max(...positions.map((value) => value.y + value.height))
        ]
      }
      naturalFlow.pageStripMatches =
        naturalFlow.sourceUnchanged &&
        naturalFlow.allGlyphsHaveGeometry &&
        naturalFlow.pageIndexesNondecreasing &&
        naturalFlow.pages >= 3 &&
        gutterViolations === 0 &&
        naturalFlow.yExtent[0] >= -1 &&
        naturalFlow.yExtent[1] <= 401
    }
    result.push({
      name: item.name,
      mode: item.mode,
      first,
      second,
      third,
      dx,
      dy,
      physicalSideBySide,
      naturalFlow
    })
  }
  clear()
  return result
}

async function projectionResults() {
  const source = '春の風が窓から入る。書架には古い物語が並び、遠くで列車の音がした。'.repeat(24)
  const results = []
  for (const mode of ['horizontal-tb', 'vertical-rl', 'vertical-lr']) {
    clear()
    const horizontal = mode === 'horizontal-tb'
    document.getElementById('stage').style.cssText =
      `display:flex;gap:20px;width:580px;direction:${mode === 'vertical-rl' ? 'rtl' : 'ltr'}`
    const views = []
    for (let index = 0; index < 2; index++) {
      const frame = await mount({
        replace: false,
        width: 280,
        height: 400,
        rootStyle: `writing-mode:${mode};direction:ltr;overflow:hidden`,
        styles: `#flow{writing-mode:${mode};font:20px/1.5 serif;width:280px;height:400px;column-count:1;column-gap:20px;column-fill:auto}`,
        content: '<div id="flow"><p id="text">' + source + '</p></div>'
      })
      const doc = frame.contentDocument
      const node = doc.getElementById('text').firstChild
      const scroller = doc.scrollingElement
      const moveTo = (page) => {
        if (horizontal) scroller.scrollLeft = page * 300
        else scroller.scrollTop = page * 420
      }
      const boundsAt = (offset) => {
        const range = doc.createRange()
        range.setStart(node, offset)
        range.setEnd(node, offset + 1)
        return range.getBoundingClientRect()
      }
      const visible = () =>
        Array.from({ length: node.length }, (_, offset) => offset).filter((offset) => {
          const rect = boundsAt(offset)
          const centerX = (rect.left + rect.right) / 2,
            centerY = (rect.top + rect.bottom) / 2
          return centerX >= 0 && centerX < 280 && centerY >= 0 && centerY < 400
        })
      moveTo(index)
      views.push({ frame, doc, node, scroller, moveTo, boundsAt, visible })
    }
    const visible = views.map((view) => view.visible())
    const sequential =
      visible.every(
        (offsets) =>
          offsets.length > 0 &&
          offsets.every((value, index) => index === 0 || value === offsets[index - 1] + 1)
      ) &&
      visible[0][0] === 0 &&
      visible[0].at(-1) + 1 === visible[1][0]
    if (!sequential)
      throw new Error('Two projections did not show adjacent complete source ranges.')
    const hits = views.map((view, index) => {
      const offset = index === 0 ? visible[0].at(-12) : visible[1][12]
      const bounds = view.boundsAt(offset)
      const x = (bounds.left + bounds.right) / 2,
        y = (bounds.top + bounds.bottom) / 2
      const position = view.doc.caretPositionFromPoint(x, y)
      if (
        !position ||
        position.offsetNode !== view.node ||
        ![offset, offset + 1].includes(position.offset)
      )
        throw new Error('A visible projection did not recover its source text hit.')
      return position.offset
    })
    const excerpt = source.slice(hits[0], hits[1])
    if (!excerpt.length || hits[0] >= visible[1][0] || hits[1] < visible[1][0])
      throw new Error('The controlled logical range did not cross the two projections.')
    const sourceOffset = visible[1][Math.floor(visible[1].length / 2)]
    for (const view of views) {
      view.moveTo(0)
      view.doc.getElementById('flow').style.fontSize = '28px'
    }
    const target = views[0].boundsAt(sourceOffset)
    const targetPage = Math.floor(
      ((horizontal ? target.left : target.top) + 0.2) / (horizontal ? 300 : 420)
    )
    const groupStart = Math.floor(targetPage / 2) * 2
    views.forEach((view, index) => view.moveTo(groupStart + index))
    const after = views.map((view) => view.visible())
    if (
      after.filter((offsets) => offsets.includes(sourceOffset)).length !== 1 ||
      views.some((view) => view.node.nodeValue !== source)
    )
      throw new Error('The saved source position did not survive reflow across its projections.')
    const frameRects = views.map((view) => rectangles(view.frame))
    const correctPhysicalOrder =
      mode === 'vertical-rl' ? frameRects[0].x > frameRects[1].x : frameRects[0].x < frameRects[1].x
    if (!correctPhysicalOrder)
      throw new Error('Source order was confused with physical slot order.')
    results.push({
      mode,
      sourceCharacters: source.length,
      domProjections: 2,
      sourceUnchanged: true,
      correctPhysicalOrder,
      initialVisibleRanges: visible.map((offsets) => ({
        start: offsets[0],
        end: offsets.at(-1) + 1
      })),
      savedOffset: sourceOffset,
      savedCodePoint: source.codePointAt(sourceOffset),
      reflowedPage: targetPage,
      reflowedGroupStart: groupStart,
      savedTargetVisibleExactlyOnce: true,
      sourceHitOffsets: hits,
      logicalExcerptLength: excerpt.length,
      frameRects,
      accessibilityExposureImplemented: false,
      pointerSelectionAcrossProjectionsExecuted: false
    })
  }
  clear()
  return results
}

window.scopeProof = {
  configure(name) {
    engineName = name
  },
  prepareEvents,
  eventResult,
  layoutResults,
  projectionResults,
  clear,
  capabilities() {
    return {
      columnWrap: CSS.supports('column-wrap', 'wrap'),
      columnHeight: CSS.supports('column-height', '280px'),
      explicitColumnBreak: CSS.supports('break-before', 'column'),
      webkitColumnAxis: CSS.supports('-webkit-column-axis', 'horizontal'),
      webkitColumnProgression: CSS.supports('-webkit-column-progression', 'reversed'),
      caretPosition: typeof document.caretPositionFromPoint === 'function',
      caretRange: typeof document.caretRangeFromPoint === 'function',
      selectionModify: typeof getSelection().modify === 'function',
      clipboardItem: typeof ClipboardItem !== 'undefined',
      nodeInPage: typeof process !== 'undefined'
    }
  }
}
