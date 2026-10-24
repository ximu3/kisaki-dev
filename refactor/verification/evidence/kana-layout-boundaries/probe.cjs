// Observe layout-context and font-completion boundaries without a Reader implementation.
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
let fontRequests = 0

async function observeBoundaries() {
  const assert = (condition, description) => {
    if (!condition) throw new Error(description)
  }
  const mount = async (markup) => {
    const frame = document.createElement('iframe')
    frame.sandbox = 'allow-same-origin'
    frame.style.cssText = 'width:800px;height:300px;border:0'
    const loaded = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }))
    frame.srcdoc = markup
    document.body.append(frame)
    await loaded
    return frame
  }

  const style = `<style>
    article { font:16px monospace; }
    article > p { margin:0; color:rgb(0,0,0); }
    article > p:first-child { font-size:32px; }
    article > p:nth-of-type(2) { color:rgb(0,120,0); }
    #before + #target { text-indent:24px; }
  </style>`
  const target = '<p id="target" data-source="same-node">Target text</p>'
  const whole = await mount(
    `${style}<article><h2>Heading</h2><p id="before">Earlier text</p>${target}</article>`
  )
  const fragment = await mount(`${style}<article>${target}</article>`)
  const inspect = (frame) => {
    const node = frame.contentDocument.getElementById('target')
    const computed = frame.contentWindow.getComputedStyle(node)
    return {
      source: node.dataset.source,
      text: node.textContent,
      color: computed.color,
      fontSize: computed.fontSize,
      textIndent: computed.textIndent
    }
  }
  const wholeStyle = inspect(whole)
  const fragmentStyle = inspect(fragment)
  assert(
    wholeStyle.source === fragmentStyle.source && wholeStyle.text === fragmentStyle.text,
    'Source fixture differs'
  )
  assert(wholeStyle.color !== fragmentStyle.color, 'Expected sibling-index difference')
  assert(wholeStyle.fontSize !== fragmentStyle.fontSize, 'Expected first-child difference')
  assert(wholeStyle.textIndent !== fragmentStyle.textIndent, 'Expected adjacent-sibling difference')
  whole.remove()
  fragment.remove()

  const tableStyle =
    '<style>table { font:16px monospace; border-spacing:0; } td { padding:0; }</style>'
  const tableTarget = '<tr id="target"><td>AA</td><td>BB</td></tr>'
  const wholeTable = await mount(
    `${tableStyle}<table><tbody><tr><td>ABCDEFGHIJKLMNOPQRSTUVWXYZ</td><td>CD</td></tr>${tableTarget}</tbody></table>`
  )
  const partialTable = await mount(`${tableStyle}<table><tbody>${tableTarget}</tbody></table>`)
  const cellWidth = (frame) =>
    frame.contentDocument.querySelector('#target td').getBoundingClientRect().width
  const widths = { whole: cellWidth(wholeTable), fragment: cellWidth(partialTable) }
  assert(widths.whole > widths.fragment, 'Expected intrinsic table-width difference')
  wholeTable.remove()
  partialTable.remove()

  const firstFace = new FontFace('KanaBrokenFirst', 'url(/first.woff)')
  document.fonts.add(firstFace)
  document.body.style.fontFamily = 'KanaBrokenFirst, monospace'
  const text = document.createElement('p')
  text.textContent = 'Synthetic font observation'
  document.body.append(text)
  const firstLoad = document.fonts.load('16px KanaBrokenFirst', text.textContent).then(
    () => 'fulfilled',
    () => 'rejected'
  )
  document.body.getBoundingClientRect()
  const firstReady = document.fonts.ready
  const firstReadyOutcome = await firstReady.then(
    () => 'fulfilled',
    () => 'rejected'
  )
  const firstLoadOutcome = await firstLoad
  assert(
    firstReadyOutcome === 'fulfilled' && firstLoadOutcome === 'rejected',
    'Expected distinct font-completion outcomes'
  )
  assert(firstFace.status === 'error', 'Expected invalid font to fail')

  const secondFace = new FontFace('KanaBrokenSecond', 'url(/second.woff)')
  document.fonts.add(secondFace)
  text.style.fontFamily = 'KanaBrokenSecond, monospace'
  const secondLoad = document.fonts.load('16px KanaBrokenSecond', text.textContent).then(
    () => 'fulfilled',
    () => 'rejected'
  )
  text.getBoundingClientRect()
  const secondReady = document.fonts.ready
  const pending = {
    oldPromiseStillFulfilled: await firstReady.then(() => true),
    newReadyPromise: secondReady !== firstReady,
    faceStatus: secondFace.status,
    setStatus: document.fonts.status
  }
  assert(
    pending.oldPromiseStillFulfilled && pending.newReadyPromise,
    'Expected a new font-loading cycle'
  )
  assert(pending.faceStatus === 'loading', 'Expected the second face to be pending')
  const secondReadyOutcome = await secondReady.then(
    () => 'fulfilled',
    () => 'rejected'
  )
  const secondLoadOutcome = await secondLoad
  assert(
    secondReadyOutcome === 'fulfilled' && secondLoadOutcome === 'rejected',
    'Expected second font failure'
  )
  document.fonts.delete(firstFace)
  document.fonts.delete(secondFace)
  text.remove()

  return {
    sourcePreservedButStylesChanged: { whole: wholeStyle, fragment: fragmentStyle },
    tableContext: widths,
    fontCompletion: {
      first: { ready: firstReadyOutcome, load: firstLoadOutcome, status: firstFace.status },
      nextCycle: pending,
      second: { ready: secondReadyOutcome, load: secondLoadOutcome, status: secondFace.status }
    },
    readerImplemented: false,
    clipboardAccessed: false,
    nodeInRenderer: typeof process !== 'undefined'
  }
}

async function main() {
  await app.whenReady()
  server = http.createServer((request, response) => {
    if (request.url === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      response.end(
        '<!doctype html><meta charset="utf-8"><title>Layout boundary probe</title><body></body>'
      )
      return
    }
    if (request.url === '/first.woff' || request.url === '/second.woff') {
      fontRequests++
      setTimeout(() => {
        response.writeHead(200, { 'Content-Type': 'font/woff', 'Cache-Control': 'no-store' })
        response.end('deliberately invalid synthetic font')
      }, 120)
      return
    }
    response.writeHead(404).end()
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
      partition: 'kana-layout-boundaries'
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
  const observed = await window.webContents.executeJavaScript(`(${observeBoundaries.toString()})()`)
  if (externalRequests || observed.nodeInRenderer || fontRequests !== 2)
    throw new Error('Unexpected probe environment')
  const result = {
    checkedAt: new Date().toISOString(),
    electron: process.versions.electron,
    chromium: process.versions.chrome,
    probeSha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
    externalRequests,
    fontRequests,
    ...observed
  }
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n')
  process.stdout.write(JSON.stringify(result) + '\n')
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
