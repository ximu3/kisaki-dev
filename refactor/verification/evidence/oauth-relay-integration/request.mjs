// Compare Fetch replay with a single native ClientRequest on owned HTTP endpoints.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { Agent, createServer, request } from 'node:http'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { createGunzip, gzipSync } from 'node:zlib'

const here = new URL('./', import.meta.url)
const inputUrl = new URL('../oauth-relay-delivery/source-input.json', here)
const inputs = JSON.parse(readFileSync(inputUrl, 'utf8'))
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
assert.equal(process.version, inputs.node.version)
assert.equal(hash(readFileSync(process.execPath)), inputs.node.exeSha256)

class BodyLimitError extends Error {}

const servers = []
const agent = new Agent({ keepAlive: true })
const body = 'grant_type=authorization_code&code=owned-code&client_secret=owned-value'
const decoded = Buffer.from(JSON.stringify({ padding: 'x'.repeat(256 * 1024) }))
const compressed = gzipSync(decoded)
const counts = { misdirected: 0, redirect: 0, compressed: 0, waiting: 0, target: 0 }
let waitingClosedResolve
const waitingClosed = new Promise((resolve) => {
  waitingClosedResolve = resolve
})

async function listen(handler) {
  const server = createServer(handler)
  servers.push(server)
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  return `http://127.0.0.1:${server.address().port}`
}

async function sendOnce(url, signal, observation, limit = 1024 * 1024) {
  let outgoing
  const incoming = await new Promise((resolve, reject) => {
    outgoing = request(
      url,
      {
        method: 'POST',
        agent,
        signal,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
          'Accept-Encoding': 'gzip'
        }
      },
      resolve
    )
    outgoing.once('error', reject)
    outgoing.end(body)
  })
  observation.status = incoming.statusCode
  observation.wireBytes = 0
  observation.decodedBytes = 0
  incoming.on('data', (chunk) => {
    observation.wireBytes += chunk.byteLength
  })
  const decoder = incoming.headers['content-encoding'] === 'gzip' ? createGunzip() : null
  let completed = false
  try {
    await pipeline(
      incoming,
      ...(decoder ? [decoder] : []),
      async (source) => {
        for await (const chunk of source) {
          observation.decodedBytes += chunk.byteLength
          if (observation.decodedBytes > limit) {
            throw new BodyLimitError('The decoded fixture response exceeds its limit.')
          }
        }
      },
      { signal }
    )
    completed = true
  } finally {
    if (!completed) {
      outgoing.destroy()
      incoming.destroy()
      decoder?.destroy()
    }
    observation.completed = completed
    observation.responseDestroyed = incoming.destroyed
    observation.decoderDestroyed = decoder?.destroyed ?? null
  }
}

const observations = []
try {
  const target = await listen((req, res) => {
    counts.target++
    req.resume()
    res.end('owned-target')
  })
  const upstream = await listen((req, res) => {
    req.resume()
    if (req.url === '/misdirected') {
      counts.misdirected++
      res.writeHead(421, { 'Content-Type': 'application/json' })
      res.end('{"error":"owned-fixture"}')
    } else if (req.url === '/redirect') {
      counts.redirect++
      res.writeHead(307, { Location: `${target}/capture` })
      res.end()
    } else if (req.url === '/compressed') {
      counts.compressed++
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip',
        'Content-Length': compressed.byteLength
      })
      res.end(compressed)
    } else if (req.url === '/waiting') {
      counts.waiting++
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.flushHeaders()
      res.once('close', () => waitingClosedResolve(!res.writableEnded))
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  const fetchResult = await fetch(`${upstream}/misdirected`, {
    method: 'POST',
    body,
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal: AbortSignal.timeout(5000)
  })
  assert.equal(fetchResult.status, 421)
  await fetchResult.body.cancel()
  assert.equal(counts.misdirected, 2)
  const single = { case: 'misdirected-request', fetchRequests: counts.misdirected }
  await sendOnce(`${upstream}/misdirected`, AbortSignal.timeout(5000), single)
  single.nativeRequests = counts.misdirected - single.fetchRequests
  assert.equal(single.status, 421)
  assert.equal(single.nativeRequests, 1)
  observations.push(single)

  const redirect = { case: 'redirect' }
  await sendOnce(`${upstream}/redirect`, AbortSignal.timeout(5000), redirect)
  assert.equal(redirect.status, 307)
  assert.equal(counts.redirect, 1)
  assert.equal(counts.target, 0)
  observations.push({ ...redirect, nativeRequests: counts.redirect, targetRequests: counts.target })

  const bounded = { case: 'compressed-response', limitBytes: 16384 }
  await assert.rejects(
    sendOnce(`${upstream}/compressed`, AbortSignal.timeout(5000), bounded, bounded.limitBytes),
    BodyLimitError
  )
  assert(bounded.wireBytes < bounded.limitBytes)
  assert(bounded.decodedBytes > bounded.limitBytes)
  assert(bounded.responseDestroyed && bounded.decoderDestroyed && !bounded.completed)
  assert.equal(counts.compressed, 1)
  observations.push({ ...bounded, nativeRequests: counts.compressed, bodyParsed: false })

  const waiting = { case: 'response-deadline', deadlineMs: 100 }
  const deadline = AbortSignal.timeout(waiting.deadlineMs)
  await assert.rejects(sendOnce(`${upstream}/waiting`, deadline, waiting), (error) => {
    waiting.nativeErrorCode = error.code ?? null
    return deadline.aborted && error instanceof Error
  })
  waiting.deadlineAborted = deadline.aborted
  assert.equal(waiting.status, 200)
  const upstreamClosed = await Promise.race([
    waitingClosed,
    new Promise((_, reject) => {
      const timeout = setTimeout(() => reject(new Error('The owned response stayed open.')), 2000)
      timeout.unref()
      waitingClosed.finally(() => clearTimeout(timeout))
    })
  ])
  assert(upstreamClosed && waiting.responseDestroyed && !waiting.completed)
  assert.equal(counts.waiting, 1)
  observations.push({
    ...waiting,
    nativeRequests: counts.waiting,
    upstreamClosedBeforeEnd: upstreamClosed
  })
} finally {
  agent.destroy()
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
  httpsExecuted: false,
  realProviderRequests: false,
  realCredentialsUsed: false,
  productionRelayImplemented: false
}
writeFileSync(new URL('request-contract.json', here), `${JSON.stringify(receipt, null, 2)}\n`)
process.stdout.write(
  `${JSON.stringify({ observations: observations.length, fetch421Requests: 2, native421Requests: 1, listenersClosed: servers.length })}\n`
)
