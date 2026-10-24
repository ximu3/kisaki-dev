// Two local HTTP origins exercise actual Fetch headers, decoding and source consistency.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const zlib = require('node:zlib')
const crypto = require('node:crypto')
const [cacheArgument, outputArgument] = process.argv.slice(2)
const cache = path.resolve(cacheArgument)
fs.mkdirSync(cache, { recursive: true })
app.setPath('userData', path.join(cache, 'profile'))
const requests = []
const networkErrors = []
const counts = new Map()
const gates = new Map()
const waiters = new Map()
let pageOrigin,
  otherOrigin,
  window,
  first,
  second,
  externalRequests = 0,
  cancelledResponses = 0

function endpoint(side, request, response) {
  const url = new URL(request.url, 'http://localhost')
  if (side === 'page' && url.pathname === '/') {
    response.writeHead(200, {
      'Content-Type': 'text/html',
      'Content-Security-Policy': `default-src 'none'; script-src 'self'; connect-src 'self' ${otherOrigin}`
    })
    response.end('<!doctype html><meta charset="utf-8"><title>Stable URL input proof</title>')
    return
  }
  if (side === 'page' && url.pathname === '/probe.mjs') {
    response.writeHead(200, { 'Content-Type': 'text/javascript' })
    response.end(fs.readFileSync(path.join(__dirname, 'probe.mjs')))
    return
  }
  if (url.pathname.startsWith('/waiting/')) {
    const name = url.pathname.slice(9)
    const complete = () => {
      response.writeHead(200)
      response.end('ready')
    }
    if (gates.has(name)) complete()
    else waiters.set(name, complete)
    return
  }
  const name = url.pathname.startsWith('/version/') ? url.pathname.slice(9) : url.pathname.slice(6)
  if (!url.pathname.startsWith('/file/') && !url.pathname.startsWith('/version/')) {
    response.writeHead(404)
    response.end()
    return
  }
  const cors = side === 'other'
  if (cors) {
    response.setHeader('Access-Control-Allow-Origin', pageOrigin)
    response.setHeader('Access-Control-Allow-Credentials', 'true')
    if (name === 'cors-visible' || name === 'cors-credentials')
      response.setHeader('Access-Control-Expose-Headers', '*')
    else if (name === 'cors-list')
      response.setHeader('Access-Control-Expose-Headers', 'ETag, Content-Range, Content-Encoding')
    else if (name === 'cors-self-list')
      response.setHeader(
        'Access-Control-Expose-Headers',
        'ETag, Content-Range, Content-Encoding, Access-Control-Expose-Headers'
      )
  }
  requests.push({
    side,
    name,
    method: request.method,
    range: request.headers.range ?? null,
    ifMatch: request.headers['if-match'] ?? null,
    requestedHeaders: request.headers['access-control-request-headers'] ?? null,
    acceptEncoding: request.headers['accept-encoding'] ?? null
  })
  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Methods', 'GET')
    response.setHeader('Access-Control-Allow-Headers', 'Range, If-Match')
    response.writeHead(204)
    response.end()
    return
  }
  const key = side + ':' + name
  const count = (counts.get(key) ?? 0) + 1
  counts.set(key, count)
  response.on('close', () => {
    if (!response.writableEnded) cancelledResponses++
  })
  if (name === 'redirect') {
    response.writeHead(302, { Location: count === 1 ? '/version/a' : '/version/b' })
    response.end()
    return
  }
  if ((name === 'cancel-range' || name === 'dispose-range') && count === 2) {
    gates.set(name, response)
    waiters.get(name)?.()
    waiters.delete(name)
    response.on('close', () => gates.delete(name))
    return
  }
  if (name === 'changed' && request.headers['if-match']) {
    response.writeHead(412, { ETag: '"v2"' })
    response.end()
    return
  }
  let payload = Buffer.from(
    Array.from(
      { length: 96 },
      (_, i) => (i + (name === 'weak' && count > 1 ? 20 : 0) + (name === 'b' ? 50 : 0)) % 256
    )
  )
  const tag =
    name === 'weak'
      ? count === 1
        ? 'W/"v1"'
        : 'W/"v2"'
      : url.pathname.startsWith('/version/')
        ? '"same-tag"'
        : '"v1"'
  response.setHeader('ETag', tag)
  response.setHeader('Cache-Control', 'no-store')
  if (name === 'gzip' || name === 'gzip-limit') {
    payload = zlib.gzipSync(Buffer.alloc(name === 'gzip' ? 128 : 2048, 65))
    response.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'gzip',
      'Content-Length': payload.length
    })
    response.end(payload)
    return
  }
  if (name === 'slow') {
    response.writeHead(200, { 'Content-Type': 'application/octet-stream' })
    let offset = 0
    const timer = setInterval(() => {
      if (response.destroyed) {
        clearInterval(timer)
        return
      }
      response.write(payload.subarray(offset, offset + 8))
      offset += 8
      if (offset >= payload.length) {
        clearInterval(timer)
        response.end()
      }
    }, 10)
    response.on('close', () => clearInterval(timer))
    return
  }
  const range = /^bytes=(\d+)-(\d+)$/.exec(request.headers.range ?? '')
  if (!range || name === 'ignored' || (name === 'ignored-later' && count > 1)) {
    response.writeHead(200, { 'Content-Length': payload.length })
    response.end(payload)
    return
  }
  const start = Number(range[1]),
    end = Math.min(Number(range[2]), payload.length - 1)
  let body = payload.subarray(start, end + 1)
  let headerStart = start
  if (name === 'wrong-range' && count > 1) headerStart++
  if (name === 'short-body' && count > 1) body = body.subarray(0, body.length - 2)
  if (name === 'missing-etag' && count > 1) response.removeHeader('ETag')
  response.writeHead(206, {
    'Content-Range': `bytes ${headerStart}-${end}/${payload.length}`,
    'Content-Length': body.length
  })
  response.end(body)
}

async function run() {
  await app.whenReady()
  first = http.createServer((request, response) => endpoint('page', request, response))
  second = http.createServer((request, response) => endpoint('other', request, response))
  await Promise.all([
    new Promise((resolve) => first.listen(0, '127.0.0.1', resolve)),
    new Promise((resolve) => second.listen(0, '127.0.0.1', resolve))
  ])
  pageOrigin = `http://127.0.0.1:${first.address().port}`
  otherOrigin = `http://127.0.0.1:${second.address().port}`
  window = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false
    }
  })
  window.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const allowed = [pageOrigin, otherOrigin].some((origin) => details.url.startsWith(origin + '/'))
    if (!allowed) externalRequests++
    callback({ cancel: !allowed })
  })
  window.webContents.session.webRequest.onErrorOccurred((details) =>
    networkErrors.push({
      name: new URL(details.url).pathname.split('/').at(-1),
      error: details.error
    })
  )
  await window.loadURL(pageOrigin)
  const result = await window.webContents.executeJavaScript(
    `import('/probe.mjs').then(module=>module.run(${JSON.stringify(otherOrigin)})).catch(error=>({failure:{name:error.name,code:error.code??null,cause:error.cause?.name,diagnostic:error.cause?.message,stage:globalThis.urlProofStage,detail:globalThis.urlProofDetail}}))`
  )
  if (result.failure) {
    fs.writeFileSync(
      path.join(cache, 'failed-observation.json'),
      JSON.stringify({ failure: result.failure, requests }, null, 2)
    )
    throw new Error('URL probe failure: ' + JSON.stringify(result.failure))
  }
  await new Promise((resolve) => setTimeout(resolve, 30))
  const ignored = requests.filter((item) => item.name === 'ignored-later' && item.method === 'GET')
  if (ignored.length !== 2 || ignored[1].ifMatch !== '"v1"')
    throw new Error('A published range source silently retried as a new snapshot.')
  if (
    !requests.some(
      (item) => item.side === 'other' && item.method === 'OPTIONS' && item.name === 'cors-visible'
    )
  )
    throw new Error('The conditional CORS request was not exercised.')
  fs.writeFileSync(
    outputArgument,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        electron: process.versions.electron,
        chromium: process.versions.chrome,
        externalRequests,
        cancelledResponses,
        requests,
        networkErrors,
        ...result,
        prototypeOnly: true,
        readerImplementationExecuted: false,
        browserSourceSha256: crypto
          .createHash('sha256')
          .update(fs.readFileSync(__filename))
          .digest('hex')
      },
      null,
      2
    ) + '\n'
  )
  console.log(
    JSON.stringify({
      scenarios: result.results.length,
      storage: result.storage,
      cancelledResponses,
      externalRequests
    })
  )
}
const close = () => {
  window?.destroy()
  for (const response of gates.values()) response.destroy()
  first?.close()
  second?.close()
}
run()
  .then(() => {
    close()
    app.exit(0)
  })
  .catch((error) => {
    console.error(error)
    close()
    app.exit(1)
  })
