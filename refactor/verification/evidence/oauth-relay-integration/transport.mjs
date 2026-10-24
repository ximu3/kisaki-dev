// Check candidate-runtime HTTP behavior using two owned loopback endpoints.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const here = new URL('./', import.meta.url)
const inputUrl = new URL('../oauth-relay-delivery/source-input.json', here)
const inputs = JSON.parse(readFileSync(inputUrl, 'utf8'))
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
assert.equal(process.version, inputs.node.version)
assert.equal(hash(readFileSync(process.execPath)), inputs.node.exeSha256)

const servers = []
let targetRequests = 0
let targetMethod
let targetBodyMatched = false
let redirectRequests = 0
let compressedRequests = 0
const ownedBody = new URLSearchParams({
  grant_type: 'authorization_code',
  code: 'owned-fixture-code',
  client_secret: 'owned-fixture-value'
}).toString()
const payload = Buffer.from(
  JSON.stringify({ access_token: 'owned-fixture-token', padding: 'x'.repeat(256 * 1024) })
)
const compressed = gzipSync(payload)
const limit = 16 * 1024
assert(compressed.byteLength < limit && payload.byteLength > limit)

async function listen(handler) {
  const server = createServer(handler)
  servers.push(server)
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  return `http://127.0.0.1:${server.address().port}`
}

const observations = []
try {
  const target = await listen((request, response) => {
    targetRequests++
    targetMethod = request.method
    let bytes = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      bytes += chunk
    })
    request.once('end', () => {
      targetBodyMatched = bytes === ownedBody
      response.end('owned-target')
    })
  })
  const upstream = await listen((request, response) => {
    request.resume()
    if (request.url === '/redirect') {
      redirectRequests++
      response.writeHead(307, { Location: `${target}/capture` })
      response.end()
    } else if (request.url === '/compressed') {
      compressedRequests++
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip',
        'Content-Length': compressed.byteLength
      })
      response.end(compressed)
    } else {
      response.writeHead(404)
      response.end()
    }
  })
  const options = () => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: ownedBody,
    signal: AbortSignal.timeout(5000)
  })

  // The control uses only synthetic values and follows a redirect between owned servers.
  const control = await fetch(`${upstream}/redirect`, options())
  assert.equal(await control.text(), 'owned-target')
  assert.equal(targetRequests, 1)
  assert.equal(targetMethod, 'POST')
  assert(targetBodyMatched)
  const before = targetRequests
  const response = await fetch(`${upstream}/redirect`, { ...options(), redirect: 'manual' })
  assert.equal(response.status, 307)
  assert.equal(response.redirected, false)
  if (response.body) await response.body.cancel()
  assert.equal(targetRequests, before)
  assert.equal(redirectRequests, 2)
  observations.push({
    case: 'redirect',
    controlTargetRequests: before,
    controlMethod: targetMethod,
    controlSyntheticBodyPreserved: targetBodyMatched,
    manualStatus: response.status,
    manualAdditionalTargetRequests: targetRequests - before,
    sourceRequests: redirectRequests,
    redirectBodyReleased: true
  })

  const controller = new AbortController()
  const zipped = await fetch(`${upstream}/compressed`, {
    redirect: 'manual',
    signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)])
  })
  assert.equal(zipped.status, 200)
  assert.equal(zipped.headers.get('content-encoding'), 'gzip')
  assert.equal(Number(zipped.headers.get('content-length')), compressed.byteLength)
  const reader = zipped.body.getReader()
  let decodedBytes = 0
  let cancelled = false
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      decodedBytes += value.byteLength
      if (decodedBytes > limit) {
        await reader.cancel()
        cancelled = true
        break
      }
    }
  } finally {
    controller.abort()
    reader.releaseLock()
  }
  assert(cancelled && decodedBytes > limit)
  assert.equal(compressedRequests, 1)
  observations.push({
    case: 'compressed-response',
    wireBytes: compressed.byteLength,
    declaredContentLength: Number(zipped.headers.get('content-length')),
    fixtureDecodedBytes: payload.byteLength,
    decodedBytesObserved: decodedBytes,
    limitBytes: limit,
    readerCancelled: cancelled,
    requestAborted: controller.signal.aborted,
    bodyParsed: false,
    sourceRequests: compressedRequests
  })
} finally {
  for (const server of servers.reverse()) {
    server.closeAllConnections()
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
    assert.equal(server.listening, false)
  }
}

const receipt = {
  checkedAt: new Date().toISOString(),
  node: process.version,
  undici: process.versions.undici,
  sourceReceiptSha256: hash(readFileSync(inputUrl)),
  nodeExeSha256: inputs.node.exeSha256,
  scriptSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  observations,
  listenersClosed: servers.length,
  realProviderRequests: false,
  realCredentialsUsed: false,
  browserExecuted: false,
  productionRelayImplemented: false,
  clientPersistenceVerified: false
}
writeFileSync(new URL('transport-contract.json', here), `${JSON.stringify(receipt, null, 2)}\n`)
process.stdout.write(
  `${JSON.stringify({ cases: observations.length, node: process.version, listenersClosed: servers.length })}\n`
)
