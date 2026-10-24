// Run the unchanged reference modules in a hidden, Node-free Chromium document.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const [root, cache, output] = process.argv.slice(2).map((value) => path.resolve(value))
app.setPath('userData', path.join(cache, 'profile'))
let server,
  win,
  externalRequests = 0
async function main() {
  await app.whenReady()
  const direct = new Map([
    ['probe.html', path.join(__dirname, 'probe.html')],
    ['probe.mjs', path.join(__dirname, 'probe.mjs')],
    [
      'candidate/xml-parser.mjs',
      path.join(root, 'refactor/verification/evidence/kana-formats/xml-parser.mjs')
    ],
    [
      'epub-documents.json',
      path.join(root, 'node_modules/.cache/kana-formats/epub-documents.json')
    ],
    ['fixture.rar', path.join(root, 'node_modules/.cache/kana-rar-members/fixtures/rar5-hlink.rar')]
  ])
  const trees = new Map([
    ['upstream/', cache],
    ['fixtures/', path.join(root, 'node_modules/.cache/kana-source/fixtures')],
    ['candidate-build/', path.join(root, 'node_modules/.cache/kana-formats/xml-build')],
    ['mobi/', path.join(root, 'node_modules/.cache/kana-formats/mobi')]
  ])
  server = http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname.slice(1))
    let file = direct.get(name)
    if (!file)
      for (const [prefix, folder] of trees)
        if (name.startsWith(prefix)) {
          const candidate = path.resolve(folder, name.slice(prefix.length))
          if (candidate.startsWith(folder + path.sep)) file = candidate
          break
        }
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, {
      'Content-Type': file.endsWith('.wasm')
        ? 'application/wasm'
        : file.endsWith('.js') || file.endsWith('.mjs')
          ? 'text/javascript'
          : file.endsWith('.html')
            ? 'text/html; charset=utf-8'
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
      partition: 'kana-foliate-review'
    }
  })
  win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const external = !details.url.startsWith(origin + '/')
    if (external) externalRequests++
    callback({ cancel: external })
  })
  await win.loadURL(origin + '/probe.html')
  const result = await win.webContents.executeJavaScript(
    'reviewPromise.catch((error) => ({ probeError: error.stack }))'
  )
  if (result.probeError) throw new Error(result.probeError)
  if (externalRequests) throw new Error('The reference parser attempted an external request')
  fs.writeFileSync(
    output,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        electron: process.versions.electron,
        chromium: process.versions.chrome,
        externalRequests,
        nodeInRenderer: await win.webContents.executeJavaScript('typeof process !== "undefined"'),
        ...result
      },
      null,
      2
    ) + '\n'
  )
  process.stdout.write(
    JSON.stringify({
      assertions: result.upstreamTests.assertions,
      failed: result.upstreamTests.failed,
      repeatedSpineResolvedIndex: result.repeatedSpine.resolvedIndex,
      fb2: result.fb2.map(({ name, opened }) => ({ name, opened }))
    }) + '\n'
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
