// Run the isolated browser proof without exposing a Node bridge to book documents.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const [cache, output] = process.argv.slice(2)
app.setPath('userData', path.join(cache, 'electron-profile'))
const requests = []
const mime = {
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.html': 'text/html',
  '.json': 'application/json',
  '.wasm': 'application/wasm'
}
let server
let window
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function main() {
  await app.whenReady()
  server = http.createServer((req, res) => {
    const route = new URL(req.url, 'http://localhost').pathname
    const mappings = [
      ['/probe/', __dirname],
      ['/pdf/', path.join(cache, 'pdf/package')],
      ['/zip/', path.join(cache, 'zip/package')],
      ['/bytes/', path.join(cache, 'fixtures')]
    ]
    const mapping = mappings.find(([prefix]) => route.startsWith(prefix))
    const file =
      route === '/fixtures.json'
        ? path.join(cache, 'fixtures/manifest.json')
        : mapping && path.resolve(mapping[1], route.slice(mapping[0].length))
    if (
      !file ||
      (mapping && !file.startsWith(path.resolve(mapping[1]) + path.sep)) ||
      !fs.existsSync(file)
    ) {
      res.writeHead(404).end()
      return
    }
    const stat = fs.statSync(file)
    if (!stat.isFile()) {
      res.writeHead(404).end()
      return
    }
    const range = /^bytes=(\d+)-(\d+)$/.exec(req.headers.range || '')
    const begin = range ? Number(range[1]) : 0
    const end = range ? Number(range[2]) + 1 : stat.size
    if (begin < 0 || end > stat.size || end <= begin) {
      res.writeHead(416).end()
      return
    }
    if (route.startsWith('/bytes/')) requests.push({ route, begin, end })
    res.writeHead(range ? 206 : 200, {
      'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
      'Content-Length': end - begin,
      ...(range ? { 'Content-Range': `bytes ${begin}-${end - 1}/${stat.size}` } : {})
    })
    fs.createReadStream(file, { start: begin, end: end - 1 }).pipe(res)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  window = new BrowserWindow({
    width: 1100,
    height: 900,
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      partition: 'kana-reading-proof'
    }
  })
  const externalRequests = []
  window.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const external = /^https?:/.test(details.url) && !details.url.startsWith(origin + '/')
    if (external) externalRequests.push(details.url)
    callback({ cancel: external })
  })
  await window.loadURL(origin + '/probe/reading-probe.html')
  for (let i = 0; i < 100; i++) {
    if (await window.webContents.executeJavaScript('globalThis.probeReady === true')) break
    await delay(50)
  }
  const plan = await window.webContents.executeJavaScript('globalThis.pointerPlan')
  if (!plan) throw new Error('Browser proof did not initialize')
  window.webContents.sendInputEvent({ type: 'mouseMove', ...plan.start })
  window.webContents.sendInputEvent({
    type: 'mouseDown',
    button: 'left',
    clickCount: 1,
    ...plan.start
  })
  await delay(50)
  for (let step = 1; step <= 8; step++) {
    const x = Math.round(plan.start.x + ((plan.end.x - plan.start.x) * step) / 8)
    const y = Math.round(plan.start.y + ((plan.end.y - plan.start.y) * step) / 8)
    window.webContents.sendInputEvent({ type: 'mouseMove', button: 'left', x, y })
    await delay(16)
  }
  window.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...plan.end })
  await delay(50)
  const result = await window.webContents.executeJavaScript('globalThis.finishReadingProbe()')
  if (externalRequests.length)
    throw new Error('Book resources reached the network request boundary')
  fs.writeFileSync(
    output,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        electron: process.versions.electron,
        chromium: process.versions.chrome,
        platform: process.platform,
        arch: process.arch,
        ...result,
        externalRequests,
        sourceRequests: requests
      },
      null,
      2
    ) + '\n'
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
