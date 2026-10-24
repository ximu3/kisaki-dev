// Exercise source mapping in Chromium DOMs without exposing Node to the document.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const [cache, output] = process.argv.slice(2)
app.setPath('userData', path.join(cache, 'browser-profile'))
let server, win
let externalRequests = 0
let entityRequests = 0
async function main() {
  await app.whenReady()
  const fixtures = JSON.parse(fs.readFileSync(path.join(cache, 'fixtures.json'), 'utf8'))
  const fixtureNames = new Set(fixtures.cases.map((item) => item.name))
  server = http.createServer((req, res) => {
    const name = new URL(req.url, 'http://localhost').pathname.slice(1)
    if (name.startsWith('external-entity')) {
      entityRequests++
      res.writeHead(200, { 'Content-Type': 'application/xml' }).end('UNEXPECTED_EXTERNAL_CONTENT')
      return
    }
    const file = ['probe.html', 'probe.mjs', 'source.mjs'].includes(name)
      ? path.join(__dirname, name)
      : name === 'fixtures.json'
        ? path.join(cache, name)
        : name.startsWith('fixtures/') && fixtureNames.has(name.slice(9))
          ? path.join(cache, name)
          : null
    if (!file) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, {
      'Content-Type': name.endsWith('.html')
        ? 'text/html; charset=utf-8'
        : name.endsWith('.mjs')
          ? 'text/javascript'
          : 'application/octet-stream'
    })
    fs.createReadStream(file).pipe(res)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      partition: 'kana-source-proof'
    }
  })
  win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const external = !details.url.startsWith(origin + '/')
    if (external) externalRequests++
    callback({ cancel: external })
  })
  await win.loadURL(origin + '/probe.html')
  for (let i = 0; i < 100; i++) {
    if (await win.webContents.executeJavaScript('typeof runSourceProof === "function"')) break
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  const result = await win.webContents.executeJavaScript(
    'runSourceProof().catch((error) => ({ probeFailure: error.stack, reason: error.reason }))'
  )
  if (result.probeFailure) throw new Error(JSON.stringify(result))
  if (externalRequests || entityRequests)
    throw new Error('XML parsing attempted an external entity load')
  fs.writeFileSync(
    output,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        electron: process.versions.electron,
        chromium: process.versions.chrome,
        platform: process.platform,
        arch: process.arch,
        externalRequests,
        entityRequests,
        nodeInRenderer: await win.webContents.executeJavaScript('typeof process !== "undefined"'),
        ...result,
        productionReaderExecuted: false,
        allFormatsValidated: false
      },
      null,
      2
    ) + '\n'
  )
  process.stdout.write(JSON.stringify(result.totals) + '\n')
  win.destroy()
  await new Promise((resolve) => server.close(resolve))
  app.quit()
}
main().catch((error) => {
  console.error(error)
  win?.destroy()
  server?.close()
  app.exit(1)
})
