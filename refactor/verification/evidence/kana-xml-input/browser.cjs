// Observe real browser DOM differences and the independent Worker/Wasm route on local fixtures.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const crypto = require('node:crypto')

const [cacheArgument, outputArgument] = process.argv.slice(2)
const cache = path.resolve(cacheArgument)
const output = path.resolve(outputArgument)
const sourceCache = path.resolve(__dirname, '../../../../node_modules/.cache/kana-source')
const fixtureReceiptPath = path.resolve(__dirname, '../kana-source/fixture-input.json')
const fixtureReceipt = JSON.parse(fs.readFileSync(fixtureReceiptPath, 'utf8'))
const fixtureBytes = fs.readFileSync(path.join(sourceCache, 'fixtures.json'))
if (
  crypto.createHash('sha256').update(fixtureBytes).digest('hex') !==
  fixtureReceipt.expectationsSha256
)
  throw new Error('The independent XML fixture expectations changed.')
const fixtures = JSON.parse(fixtureBytes)
const fb2Names = new Set(
  fixtures.cases.filter((item) => item.format === 'fb2').map((item) => item.name)
)
for (const item of fixtureReceipt.cases.filter((item) => item.format === 'fb2'))
  if (
    crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(sourceCache, 'fixtures', item.name)))
      .digest('hex') !== item.sha256
  )
    throw new Error('An independent XML fixture changed.')
app.setPath('userData', path.join(cache, 'profile'))
let server, window
let externalRequests = 0

async function observe() {
  const [{ default: factory }, modules, parserModule, comparisonModule, boundaryModule] =
    await Promise.all([
      import('/expat/expat.mjs'),
      import('/candidates.mjs'),
      import('/proof/parser.mjs'),
      import('/proof/compare.mjs'),
      import('/proof/boundaries.mjs')
    ])
  const [catalog, maps, entities] = await Promise.all(
    ['catalog.json', 'encoding-maps.json', 'entities.json'].map(async (name) =>
      (await fetch('/' + name)).json()
    )
  )
  const parser = await parserModule.createParser(factory, catalog, maps)
  const comparison = await comparisonModule.compare(modules, parser, entities, DOMParser)
  const allCatalog = comparisonModule.checkCatalog(parser, entities, DOMParser)
  const byteAndBudget = boundaryModule.boundaries(parser)
  const runWorker = (mode) =>
    new Promise((resolve, reject) => {
      const worker = new Worker('/proof/worker.mjs', { type: 'module' })
      let completed = false
      const timeout = setTimeout(() => {
        worker.terminate()
        reject(new Error('XML worker timed out.'))
      }, 15000)
      worker.onerror = () => {
        clearTimeout(timeout)
        worker.terminate()
        reject(new Error('XML worker failed.'))
      }
      worker.onmessage = ({ data }) => {
        if (mode === 'interrupt' && data.type === 'enteredParser') {
          clearTimeout(timeout)
          worker.terminate()
          setTimeout(() => {
            worker.onmessage = null
            if (completed) reject(new Error('The interrupted XML operation delivered a result.'))
            else
              resolve({
                terminatedAfterEnteringParser: true,
                completeResultDelivered: false,
                observationMs: 20
              })
          }, 20)
        } else if (data.type === 'result') {
          clearTimeout(timeout)
          worker.terminate()
          resolve(data)
        } else {
          if (data.type === 'finishedLargeParse') completed = true
          clearTimeout(timeout)
          worker.terminate()
          reject(new Error('Unexpected XML worker completion.'))
        }
      }
      worker.postMessage({ mode })
    })
  const interrupted = await runWorker('interrupt')
  const worker = await runWorker('matrix')
  return {
    comparison,
    catalog: allCatalog,
    byteAndBudget,
    interrupted,
    worker,
    nodeInRenderer: typeof process !== 'undefined'
  }
}

async function run() {
  await app.whenReady()
  server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname
    if (pathname === '/') {
      response.writeHead(200, {
        'Content-Type': 'text/html',
        'Content-Security-Policy':
          "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'self'"
      })
      response.end('<!doctype html><meta charset="utf-8"><title>XML source proof</title>')
      return
    }
    const proofFiles = new Set([
      'parser.mjs',
      'cases.mjs',
      'compare.mjs',
      'boundaries.mjs',
      'worker.mjs'
    ])
    const cacheFiles = new Set([
      'candidates.mjs',
      'catalog.json',
      'entities.json',
      'encoding-maps.json',
      'expat/expat.mjs',
      'expat/expat.wasm'
    ])
    let target
    if (pathname === '/fb2-fixtures.json') {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(fixtureBytes)
      return
    }
    if (pathname.startsWith('/fb2/') && fb2Names.has(pathname.slice(5)))
      target = path.join(sourceCache, 'fixtures', pathname.slice(5))
    if (pathname.startsWith('/proof/') && proofFiles.has(pathname.slice(7)))
      target = path.join(__dirname, pathname.slice(7))
    else if (cacheFiles.has(pathname.slice(1))) target = path.join(cache, pathname.slice(1))
    if (!target) {
      response.writeHead(404)
      response.end()
      return
    }
    const type = target.endsWith('.mjs')
      ? 'text/javascript'
      : target.endsWith('.wasm')
        ? 'application/wasm'
        : 'application/json'
    response.writeHead(200, { 'Content-Type': type })
    response.end(fs.readFileSync(target))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  window = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })
  window.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const allowed = details.url.startsWith(origin + '/')
    if (!allowed) externalRequests++
    callback({ cancel: !allowed })
  })
  await window.loadURL(origin)
  const result = await window.webContents.executeJavaScript(`(${observe.toString()})()`)
  if (
    result.comparison.expat.matched !== result.comparison.expat.comparisons ||
    result.catalog.mismatches.length ||
    !result.catalog.browserMatched
  )
    throw new Error('The XML catalog candidate did not satisfy the browser expectations.')
  if (
    result.worker.comparison.expat.matched !== result.worker.comparison.expat.comparisons ||
    result.worker.nodeAvailable ||
    result.worker.nativeDOMParserAvailable
  )
    throw new Error('The XML worker did not satisfy the expected environment and source rules.')
  fs.writeFileSync(
    output,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        electron: process.versions.electron,
        chromium: process.versions.chrome,
        externalRequests,
        readerImplementationExecuted: false,
        ...result,
        browserSourceSha256: crypto
          .createHash('sha256')
          .update(fs.readFileSync(__filename))
          .digest('hex'),
        fb2ReceiptSha256: crypto
          .createHash('sha256')
          .update(fs.readFileSync(fixtureReceiptPath))
          .digest('hex')
      },
      null,
      2
    ) + '\n'
  )
  console.log(
    JSON.stringify({
      browserComparisons: result.comparison.expat.comparisons,
      catalogNames: result.catalog.names,
      nativeDOMMatched: result.comparison['native-dom'].matched,
      nativeDOMTotal: result.comparison['native-dom'].comparisons,
      workerComparisons: result.worker.comparison.expat.comparisons,
      workerInterrupted: result.interrupted.terminatedAfterEnteringParser,
      externalRequests
    })
  )
}

run()
  .then(() => {
    window?.destroy()
    server?.close()
    app.exit(0)
  })
  .catch((error) => {
    console.error(error)
    window?.destroy()
    server?.close()
    app.exit(1)
  })
