// Observe native pagination and typography mechanisms in isolated, script-disabled documents.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const crypto = require('node:crypto')
const [cacheArgument, outputArgument] = process.argv.slice(2)
const cache = path.resolve(cacheArgument)
const output = path.resolve(outputArgument)
fs.mkdirSync(cache, { recursive: true })
app.setPath('userData', path.join(cache, 'profile'))
let server, window
let externalRequests = 0

async function observe() {
  const mount = async (styles, contents) => {
    const frame = document.createElement('iframe')
    frame.sandbox = 'allow-same-origin'
    frame.style.cssText = 'width:900px;height:600px;border:0;display:block'
    const ready = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }))
    frame.srcdoc = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0}p{margin:0}${styles}</style>${contents}`
    document.body.append(frame)
    await ready
    return frame
  }
  const rect = (element) => {
    const { x, y, width, height } = element.getBoundingClientRect()
    return { x, y, width, height }
  }
  const samples = []
  const content =
    '<p id="first">第一页</p><p id="second" style="break-before:column">第二页</p><p id="third" style="break-before:column">第三页</p>'
  const configurations = [
    {
      name: 'vertical-native-columns',
      outer:
        'writing-mode:vertical-rl;width:600px;height:400px;columns:2;column-gap:20px;column-fill:auto;'
    },
    {
      name: 'vertical-wrapped-columns',
      outer:
        'writing-mode:vertical-rl;width:600px;height:400px;column-count:1;column-height:280px;column-wrap:wrap;gap:20px;column-fill:auto;'
    },
    {
      name: 'vertical-lr-wrapped-columns',
      outer:
        'writing-mode:vertical-lr;width:600px;height:400px;column-count:1;column-height:280px;column-wrap:wrap;gap:20px;column-fill:auto;'
    },
    {
      name: 'orthogonal-nested-columns',
      outer:
        'writing-mode:horizontal-tb;width:600px;height:400px;column-count:2;column-gap:20px;column-fill:auto;',
      inner:
        'writing-mode:vertical-rl;width:290px;height:400px;column-count:1;column-height:290px;column-gap:0;column-fill:auto;'
    },
    {
      name: 'horizontal-native-columns',
      outer:
        'writing-mode:horizontal-tb;width:600px;height:400px;column-count:2;column-gap:20px;column-fill:auto;'
    }
  ]
  for (const item of configurations) {
    const frame = await mount(
      `#pages{font:20px/1.5 serif;${item.outer}}#flow{${item.inner ?? ''}}`,
      `<div id="pages">${item.inner ? '<div id="flow">' + content + '</div>' : content}</div>`
    )
    const doc = frame.contentDocument
    const style = frame.contentWindow.getComputedStyle(doc.getElementById('pages'))
    samples.push({
      name: item.name,
      first: rect(doc.getElementById('first')),
      second: rect(doc.getElementById('second')),
      third: rect(doc.getElementById('third')),
      computed: {
        columnHeight: style.getPropertyValue('column-height'),
        columnWrap: style.getPropertyValue('column-wrap')
      },
      overflow: { width: doc.documentElement.scrollWidth, height: doc.documentElement.scrollHeight }
    })
    frame.remove()
  }
  const typography = []
  for (const [authoredBase, authoredParagraph, requestedSize] of [
    [14, 14, 20],
    [14, 14, 28],
    [16, 14, 20]
  ]) {
    const frame = await mount(
      `body{font:${authoredBase}px/1.5 serif}#body{font-size:${authoredParagraph}px}h1{font-size:2em}.small{font-size:10.5px}rt{font-size:50%}img{width:80px;height:40px}`,
      '<h1>标题</h1><p id="body">正文 <span class="small">小字</span><ruby>字<rt>zi</rt></ruby></p><img src="/diagram.svg" alt="fixed-size diagram">'
    )
    const doc = frame.contentDocument
    const elements = [doc.documentElement, ...doc.querySelectorAll('body,body *')].filter(
      (element) => element.namespaceURI === 'http://www.w3.org/1999/xhtml'
    )
    const baseline = parseFloat(frame.contentWindow.getComputedStyle(doc.body).fontSize)
    const original = elements.map((element) => ({
      element,
      size: parseFloat(frame.contentWindow.getComputedStyle(element).fontSize)
    }))
    for (const item of original)
      item.element.style.setProperty(
        'font-size',
        (item.size / baseline) * requestedSize + 'px',
        'important'
      )
    const measure = (selector) =>
      parseFloat(frame.contentWindow.getComputedStyle(doc.querySelector(selector)).fontSize)
    typography.push({
      requestedSize,
      baseline,
      authoredParagraph,
      paragraph: measure('#body'),
      heading: measure('h1'),
      small: measure('.small'),
      ruby: measure('rt'),
      image: rect(doc.querySelector('img'))
    })
    frame.remove()
  }
  const source = '春の風が窓から入る。書架には古い物語が並び、遠くで列車の音がした。'.repeat(24)
  const pagination = []
  for (const mode of ['horizontal-tb', 'vertical-rl', 'vertical-lr'])
    for (const faces of [1, 2])
      for (const fontSize of [20, 28]) {
        const faceWidth = 280,
          height = 400,
          gap = 20
        const width = faceWidth * faces + gap * (faces - 1)
        const horizontal = mode === 'horizontal-tb'
        const frame = await mount(
          `html{writing-mode:${mode};overflow:hidden}#flow{font:${fontSize}px/1.5 serif;writing-mode:${mode};width:${width}px;height:${height}px;column-count:${horizontal ? faces : 1};column-height:${horizontal ? height : faceWidth}px;column-wrap:${horizontal ? 'nowrap' : 'wrap'};column-fill:auto;gap:${gap}px}`,
          `<div id="flow"><p id="text">${source}</p></div>`
        )
        frame.style.width = width + 'px'
        frame.style.height = height + 'px'
        const doc = frame.contentDocument,
          flow = doc.getElementById('flow'),
          node = doc.getElementById('text').firstChild
        const origin = flow.getBoundingClientRect()
        const pageIndexes = []
        let previous = -1
        for (let offset = 0; offset < node.length; offset++) {
          const range = doc.createRange()
          range.setStart(node, offset)
          range.setEnd(node, offset + 1)
          const bounds = range.getBoundingClientRect()
          const page = horizontal
            ? Math.floor((bounds.left - origin.left + 0.1) / (faceWidth + gap))
            : Math.floor(
                ((mode === 'vertical-rl'
                  ? origin.right - bounds.right
                  : bounds.left - origin.left) +
                  0.1) /
                  (faceWidth + gap)
              )
          if (page < previous || bounds.width <= 0 || bounds.height <= 0)
            throw new Error('Native page source order or visible glyph failed.')
          previous = page
          pageIndexes.push(page)
        }
        const scroller = doc.scrollingElement
        scroller.scrollLeft = mode === 'vertical-rl' ? -1e7 : 1e7
        const tail = doc.createRange()
        tail.setStart(node, node.length - 1)
        tail.setEnd(node, node.length)
        const last = tail.getBoundingClientRect()
        const lastVisible =
          last.right > 0 &&
          last.bottom > 0 &&
          last.left < doc.documentElement.clientWidth &&
          last.top < doc.documentElement.clientHeight
        if (!lastVisible)
          throw new Error('The final native page could not be reached by its scroll axis.')
        pagination.push({
          mode,
          faces,
          fontSize,
          sourceCharacters: node.length,
          sourceUnchanged: node.nodeValue === source,
          pages: Math.max(...pageIndexes) + 1,
          savedOffset: 317,
          savedCharacter: node.nodeValue[317],
          savedPage: pageIndexes[317],
          lastPageReachable: true,
          endScroll: { left: scroller.scrollLeft, top: scroller.scrollTop }
        })
        frame.remove()
      }
  const initialSlots = []
  for (const mode of ['horizontal-tb', 'vertical-rl']) {
    const horizontal = mode === 'horizontal-tb'
    const frame = await mount(
      `html{writing-mode:${mode};overflow:hidden}#flow{font:20px/1.5 serif;width:580px;height:400px;column-count:${horizontal ? 2 : 1};column-height:${horizontal ? 400 : 280}px;column-wrap:${horizontal ? 'nowrap' : 'wrap'};column-fill:auto;gap:20px;transform:translateX(${horizontal ? 300 : -300}px)}`,
      `<div id="flow">${content}</div>`
    )
    frame.style.width = '580px'
    frame.style.height = '400px'
    const doc = frame.contentDocument
    const first = rect(doc.getElementById('first'))
    if (horizontal ? first.x !== 300 : first.x + first.width !== 280)
      throw new Error('The initial blank slot moved source content to the wrong side.')
    doc.scrollingElement.scrollLeft = horizontal ? 600 : -600
    const second = rect(doc.getElementById('second')),
      third = rect(doc.getElementById('third'))
    if (
      horizontal
        ? second.x !== 0 || third.x !== 300
        : second.x + second.width !== 580 || third.x + third.width !== 280
    )
      throw new Error('The source pages did not regroup after the initial blank slot.')
    if (doc.getElementById('flow').children.length !== 3)
      throw new Error('View slot organization inserted a source-content node.')
    initialSlots.push({
      mode,
      first,
      second,
      third,
      sourceChildren: 3,
      sourcePlaceholderAdded: false
    })
    frame.remove()
  }
  for (const item of typography)
    if (
      item.paragraph !== (item.authoredParagraph / item.baseline) * item.requestedSize ||
      item.heading !== item.requestedSize * 2 ||
      item.ruby !== item.paragraph / 2 ||
      item.image.width !== 80 ||
      item.image.height !== 40
    )
      throw new Error('The typography scale changed source hierarchy or fixed image dimensions.')
  const caret = []
  for (const mode of ['horizontal-tb', 'vertical-rl', 'vertical-lr']) {
    const frame = await mount(
      `body{writing-mode:${mode};font:20px/1.5 serif}p{inline-size:180px}`,
      '<p id="caret">A😀B é C 物語の続きがここにある。</p>'
    )
    const doc = frame.contentDocument,
      node = doc.getElementById('caret').firstChild,
      selection = frame.contentWindow.getSelection()
    const range = doc.createRange()
    range.setStart(node, 0)
    range.collapse(true)
    selection.addRange(range)
    const offsets = []
    for (let step = 0; step < 7; step++) {
      selection.modify('move', 'forward', 'character')
      offsets.push(selection.focusOffset)
    }
    if (JSON.stringify(offsets) !== JSON.stringify([1, 3, 4, 5, 7, 8, 9]))
      throw new Error('Native character movement split the controlled graphemes.')
    selection.collapse(node, 0)
    selection.modify('move', 'forward', 'line')
    caret.push({
      mode,
      characterOffsets: offsets,
      nextLineOffset: selection.focusOffset,
      sourceUnchanged: node.nodeValue === 'A😀B é C 物語の続きがここにある。'
    })
    frame.remove()
  }
  const promisedItem = new ClipboardItem({
    'text/plain': Promise.resolve(new Blob(['complete selection'], { type: 'text/plain' }))
  })
  const deferredClipboardPayload =
    (await (await promisedItem.getType('text/plain')).text()) === 'complete selection'
  if (!deferredClipboardPayload) throw new Error('Deferred clipboard payload construction failed.')
  const wrapped = samples.find((item) => item.name === 'vertical-wrapped-columns')
  const ordinary = samples.find((item) => item.name === 'vertical-native-columns')
  if (!(
    wrapped.second.x < wrapped.first.x &&
    wrapped.second.y === wrapped.first.y &&
    ordinary.second.y > ordinary.first.y
  ))
    throw new Error('The observed vertical column directions differed from the proposal.')
  return {
    samples,
    typography,
    pagination,
    initialSlots,
    caret,
    deferredClipboardPayload,
    supports: {
      columnHeight: CSS.supports('column-height', '280px'),
      columnWrap: CSS.supports('column-wrap', 'wrap'),
      webkitColumnAxis: CSS.supports('-webkit-column-axis', 'horizontal'),
      caretPosition: typeof document.caretPositionFromPoint === 'function',
      selectionModify: typeof getSelection().modify === 'function',
      clipboardWrite: !!navigator.clipboard?.write,
      clipboardWriteText: !!navigator.clipboard?.writeText
    },
    clipboardWritten: false,
    nodeInRenderer: typeof process !== 'undefined'
  }
}

async function run() {
  await app.whenReady()
  server = http.createServer((request, response) => {
    if (request.url === '/diagram.svg') {
      response.writeHead(200, { 'Content-Type': 'image/svg+xml' })
      response.end(
        '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="navy"/></svg>'
      )
      return
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end(
      '<!doctype html><meta charset="utf-8"><title>Presentation mechanism probe</title><body></body>'
    )
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  window = new BrowserWindow({
    show: false,
    width: 1000,
    height: 800,
    webPreferences: {
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      partition: 'kana-presentation'
    }
  })
  window.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const external =
      !details.url.startsWith(origin + '/') &&
      !['about:blank', 'about:srcdoc'].includes(details.url)
    if (external) externalRequests++
    callback({ cancel: external })
  })
  await window.loadURL(origin + '/')
  const observed = await window.webContents.executeJavaScript(`(${observe.toString()})()`)
  if (externalRequests || observed.nodeInRenderer)
    throw new Error('Unexpected presentation probe environment.')
  const record = {
    checkedAt: new Date().toISOString(),
    electron: process.versions.electron,
    chromium: process.versions.chrome,
    sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
    externalRequests,
    readerImplemented: false,
    ...observed
  }
  fs.writeFileSync(output, JSON.stringify(record, null, 2) + '\n')
  process.stdout.write(JSON.stringify(observed) + '\n')
  window.destroy()
  await new Promise((resolve) => server.close(resolve))
  app.quit()
}
run().catch((error) => {
  console.error(error)
  window?.destroy()
  server?.close()
  app.exit(1)
})
