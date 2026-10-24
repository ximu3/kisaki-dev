// Observe column direction, filling and font overrides in a hidden browser document.
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
let server
let window
let externalRequests = 0

async function observeLayout() {
  const assert = (value, message) => {
    if (!value) throw new Error(message)
  }
  const mount = async (body) => {
    const frame = document.createElement('iframe')
    frame.sandbox = 'allow-same-origin'
    frame.style.cssText = 'width:800px;height:600px;border:0'
    const ready = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }))
    frame.srcdoc = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0}</style>${body}`
    document.body.append(frame)
    await ready
    return frame
  }
  const rect = (element) => {
    const { x, y, width, height } = element.getBoundingClientRect()
    return { x, y, width, height }
  }
  const directions = []
  for (const writingMode of ['horizontal-tb', 'vertical-rl']) {
    const frame = await mount(`<style>
      #columns { width:600px;height:400px;column-count:2;column-gap:20px;
        column-fill:auto;writing-mode:${writingMode};font:20px/1 serif; }
      #second { break-before:column; }
      </style><div id="columns"><div id="first">甲</div><div id="second">乙</div></div>`)
    const doc = frame.contentDocument
    directions.push({
      writingMode,
      first: rect(doc.getElementById('first')),
      second: rect(doc.getElementById('second'))
    })
    frame.remove()
  }
  assert(
    directions[0].second.x > directions[0].first.x + 100,
    'Expected horizontal columns to advance horizontally'
  )
  assert(
    Math.abs(directions[0].second.y - directions[0].first.y) < 1,
    'Unexpected horizontal column alignment'
  )
  assert(
    directions[1].second.y > directions[1].first.y + 100,
    'Expected vertical columns to advance vertically'
  )
  assert(
    Math.abs(directions[1].second.x - directions[1].first.x) < 1,
    'Unexpected vertical column alignment'
  )

  const filling = []
  for (const fill of ['balance', 'auto']) {
    const frame = await mount(`<style>
      #columns { width:400px;height:160px;column-count:2;column-gap:20px;
        column-fill:${fill};font:20px/20px monospace; }
      .line { height:20px; }
      </style><div id="columns">${Array.from({ length: 6 }, (_, index) => `<div class="line">Line ${index + 1}</div>`).join('')}</div>`)
    const rectangles = [...frame.contentDocument.querySelectorAll('.line')].map(rect)
    filling.push({
      fill,
      rectangles,
      occupiedColumns: new Set(rectangles.map((item) => item.x)).size
    })
    frame.remove()
  }
  assert(
    filling[0].occupiedColumns === 2 && filling[1].occupiedColumns === 1,
    'Expected distinct filling behavior'
  )

  const typography = []
  for (const override of ['none', 'root', 'all']) {
    const extra =
      override === 'root'
        ? 'body { font-size:24px !important; }'
        : override === 'all'
          ? '* { font-size:24px !important; }'
          : ''
    const frame = await mount(`<style>
      body { font:16px/1.4 serif; }
      h1 { font-size:2em; }
      .body-copy { font-size:14px; }
      ruby { font-size:1em; }
      rt { font-size:0.5em; }
      ${extra}
      </style><h1>Heading</h1><p class="body-copy">Body text</p><p><ruby>字<rt>zi</rt></ruby></p>`)
    const doc = frame.contentDocument
    const size = (selector) =>
      frame.contentWindow.getComputedStyle(doc.querySelector(selector)).fontSize
    typography.push({
      override,
      body: size('.body-copy'),
      heading: size('h1'),
      rubyAnnotation: size('rt')
    })
    frame.remove()
  }
  assert(
    typography[0].body === typography[1].body,
    'Root override unexpectedly replaced the explicit body-copy size'
  )
  assert(
    typography[0].heading !== typography[1].heading,
    'Expected relative headings to follow the root size'
  )
  assert(
    typography[2].heading === typography[2].rubyAnnotation &&
      typography[2].heading === typography[2].body,
    'Expected blanket override to flatten font sizes'
  )

  return {
    directions,
    filling,
    typography,
    readerImplemented: false,
    nodeInRenderer: typeof process !== 'undefined'
  }
}

async function main() {
  await app.whenReady()
  server = http.createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end(
      '<!doctype html><meta charset="utf-8"><title>Layout policy probe</title><body></body>'
    )
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  window = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      partition: 'kana-layout-policy'
    }
  })
  window.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const external =
      !details.url.startsWith(origin + '/') &&
      details.url !== 'about:blank' &&
      details.url !== 'about:srcdoc'
    if (external) externalRequests++
    callback({ cancel: external })
  })
  await window.loadURL(origin + '/')
  const observed = await window.webContents.executeJavaScript(`(${observeLayout.toString()})()`)
  if (externalRequests || observed.nodeInRenderer) throw new Error('Unexpected probe environment')
  const result = {
    checkedAt: new Date().toISOString(),
    electron: process.versions.electron,
    chromium: process.versions.chrome,
    probeSha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
    externalRequests,
    ...observed
  }
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n')
  process.stdout.write(
    JSON.stringify({
      directions: result.directions,
      filling: result.filling.map(({ fill, occupiedColumns }) => ({ fill, occupiedColumns })),
      typography: result.typography
    }) + '\n'
  )
  window.destroy()
  await new Promise((resolve) => server.close(resolve))
  app.quit()
}

main().catch((error) => {
  console.error(error)
  window?.destroy()
  server?.close()
  app.exit(1)
})
