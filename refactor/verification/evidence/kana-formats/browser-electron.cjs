// Serve only fixed proof inputs to hidden Chromium; no book or XML reference can access another origin.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const [cache, sourceCache, oldRarCache, zipRoot, output] = process.argv
  .slice(2)
  .map((value) => path.resolve(value))
app.setPath('userData', path.join(cache, 'browser-profile'))
let win,
  server,
  externalRequests = 0
async function main() {
  await app.whenReady()
  const direct = new Map([
    ...[
      'probe.html',
      'probe-worker.mjs',
      'xml-parser.mjs',
      'xml-cases.mjs',
      'names-parser.mjs',
      'cfi.mjs',
      'cfi-cases.mjs',
      'markup-map.mjs',
      'names-fixture-input.json',
      'epub-fixture-input.json'
    ].map((name) => [name, path.join(__dirname, name)]),
    ...[
      'source.epub',
      'foliate-raw.mjs',
      'parse5.mjs',
      'mobi-result.json',
      'markup-result.json',
      'oem-maps.json'
    ].map((name) => [name, path.join(cache, name)]),
    ['source-fixtures.json', path.join(sourceCache, 'fixtures.json')]
  ])
  const trees = new Map([
    ['xml-build/', path.join(cache, 'xml-build')],
    ['names-build/', path.join(cache, 'names-build')],
    ['names/', path.join(cache, 'names')],
    ['mobi/', path.join(cache, 'mobi')],
    ['source-fixtures/', path.join(sourceCache, 'fixtures')],
    ['old-rar/', path.join(oldRarCache, 'fixtures')],
    ['zip/', zipRoot]
  ])
  server = http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname.slice(1))
    let file = direct.get(name)
    if (!file)
      for (const [prefix, root] of trees)
        if (name.startsWith(prefix)) {
          const candidate = path.resolve(root, name.slice(prefix.length))
          if (candidate.startsWith(root + path.sep)) file = candidate
          break
        }
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end()
      return
    }
    const extension = path.extname(file)
    res.writeHead(200, {
      'Content-Type':
        extension === '.html'
          ? 'text/html; charset=utf-8'
          : extension === '.wasm'
            ? 'application/wasm'
            : ['.mjs', '.js'].includes(extension)
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
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      partition: 'kana-formats-proof'
    }
  })
  win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const external = !details.url.startsWith(origin + '/')
    if (external) externalRequests++
    callback({ cancel: external })
  })
  await win.loadURL(origin + '/probe.html')
  const results = {}
  for (const mode of ['xml', 'names', 'cfi', 'mobi']) {
    results[mode] = await win.webContents.executeJavaScript(`runProof(${JSON.stringify(mode)})`)
    process.stdout.write(JSON.stringify({ mode, passed: results[mode].allAssertionsPassed }) + '\n')
  }
  if (externalRequests) throw new Error('A format proof attempted external access')
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
        nodeInRenderer: await win.webContents.executeJavaScript('typeof process !== "undefined"'),
        results,
        candidateOnly: true,
        fullReaderExecuted: false
      },
      null,
      2
    ) + '\n'
  )
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
