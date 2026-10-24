// Isolated HTTP protocol experiment; this is not the production relay.
import assert from 'node:assert/strict'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const here = new URL('./', import.meta.url)
const inputs = JSON.parse(readFileSync(new URL('source-input.json', here), 'utf8'))
const sha = (value) => createHash('sha256').update(value).digest('hex')
for (const entry of inputs.packages) assert.equal(sha(readFileSync(entry.entry)), entry.entrySha256)
const { Hono } = await import(pathToFileURL(inputs.packages.find((p) => p.name === 'hono').entry))
const { serve } = await import(
  pathToFileURL(inputs.packages.find((p) => p.name === '@hono/node-server').entry)
)
const challenge = (verifier) => createHash('sha256').update(verifier, 'ascii').digest('base64url')
const nonce = () => randomBytes(32).toString('base64url')
const servers = []
const observations = []
const sessions = new Map()
const codes = new Map()
let clock = 0
let upstreamCalls = 0
let upstreamAborts = 0
let nextFault = null
let started = null

async function listen(app) {
  const server = await new Promise((resolve, reject) => {
    const instance = serve(
      { fetch: app.fetch, hostname: '127.0.0.1', port: 0, overrideGlobalObjects: false },
      () => resolve(instance)
    )
    instance.once('error', reject)
  })
  servers.push(server)
  return `http://127.0.0.1:${server.address().port}`
}

function problem(error, reason, status = 400) {
  return Response.json(
    { error, reason, error_description: 'The requested operation could not be completed.' },
    {
      status,
      headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' }
    }
  )
}

function parseFields(text) {
  const fields = new URLSearchParams(text)
  for (const key of fields.keys()) {
    if (fields.getAll(key).length !== 1) throw new TypeError('Duplicate protocol parameter.')
  }
  return fields
}

async function readBounded(body, limit) {
  if (!body) return ''
  const reader = body.getReader()
  const chunks = []
  let length = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > limit) {
        await reader.cancel()
        throw new RangeError('Protocol body exceeds its limit.')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))
}

function remove(session) {
  sessions.delete(session.upstreamState)
  if (session.codeKey) codes.delete(session.codeKey)
}

function expire() {
  for (const session of sessions.values())
    if (session.deadline <= clock && session.phase !== 'exchanging') remove(session)
}

const callbackApp = new Hono()
const received = []
callbackApp.get('/callback', (context) => {
  received.push(Object.fromEntries(new URL(context.req.url).searchParams))
  return context.text('Authorization response received.')
})

const upstreamApp = new Hono()
const issued = new Map()
upstreamApp.get('/:provider/authorize', (context) => {
  const fields = new URL(context.req.url).searchParams
  const code = nonce()
  issued.set(code, {
    provider: context.req.param('provider'),
    challenge: fields.get('code_challenge')
  })
  const target = new URL(fields.get('redirect_uri'))
  target.searchParams.set('state', fields.get('state'))
  target.searchParams.set('code', code)
  return context.redirect(target.href, 302)
})
upstreamApp.post('/:provider/token', async (context) => {
  const fields = parseFields(await context.req.text())
  upstreamCalls++
  const fault = nextFault
  nextFault = null
  if (started) {
    started()
    started = null
  }
  assert.equal(fields.get('client_secret'), 'owned-fixture-secret')
  if (fields.get('grant_type') === 'refresh_token') {
    return context.json({
      access_token: 'owned-refreshed-token',
      token_type: 'Bearer',
      expires_in: 123,
      provider_field: { retained: true }
    })
  }
  const issue = issued.get(fields.get('code'))
  issued.delete(fields.get('code'))
  if (!issue || issue.provider !== context.req.param('provider'))
    return problem('invalid_grant', 'upstream_rejected')
  if (
    issue.provider === 'strict' &&
    issue.challenge !== challenge(fields.get('code_verifier') ?? '')
  ) {
    return problem('invalid_grant', 'upstream_rejected')
  }
  if (fault === 'rate-limit')
    return new Response('', { status: 429, headers: { 'Retry-After': '7' } })
  if (fault === 'slow') {
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 1500)
      const abort = () => {
        upstreamAborts++
        clearTimeout(timer)
        resolve()
      }
      if (context.req.raw.signal.aborted) abort()
      else context.req.raw.signal.addEventListener('abort', abort, { once: true })
    })
  } else {
    await delay(25)
  }
  return context.json({
    access_token: 'owned-access-token',
    token_type: 'Bearer',
    expires_in: 123,
    refresh_token: 'owned-refresh-token',
    provider_field: { retained: true }
  })
})

const relay = new Hono()
let relayOrigin
let upstreamOrigin
let clientOrigin
relay.use('*', async (context, next) => {
  context.header('Cache-Control', 'no-store')
  context.header('Pragma', 'no-cache')
  context.header('Referrer-Policy', 'no-referrer')
  context.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
  expire()
  await next()
})
relay.onError((error) => {
  if (error instanceof TypeError) return problem('invalid_request', 'parameters')
  if (error instanceof RangeError) return problem('invalid_request', 'body_too_large', 413)
  throw error
})
relay.get('/healthz', (context) => context.json({ status: 'ok' }))
relay.use('/:application/:provider/*', async (context, next) => {
  if (
    context.req.param('application') !== 'example' ||
    !['strict', 'unbound'].includes(context.req.param('provider'))
  ) {
    return problem('invalid_request', 'registration_not_found', 404)
  }
  await next()
})
relay.get('/:application/:provider/authorize', (context) => {
  const fields = parseFields(new URL(context.req.url).search)
  if (fields.get('client_id') !== 'owned-client')
    return problem('invalid_client', 'registration_mismatch')
  const redirect = fields.get('redirect_uri') ?? ''
  if (
    !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}\/callback$/.test(redirect) ||
    new URL(redirect).port === ''
  ) {
    return problem('invalid_request', 'redirect_uri')
  }
  if (!(fields.get('state')?.length > 0)) return problem('invalid_request', 'state')
  const authorizationError = (error, reason) => {
    const target = new URL(redirect)
    target.searchParams.set('state', fields.get('state'))
    target.searchParams.set('error', error)
    target.searchParams.set('reason', reason)
    return context.redirect(target.href, 302)
  }
  if (fields.get('response_type') !== 'code')
    return authorizationError('unsupported_response_type', 'parameters')
  if (
    fields.get('code_challenge_method') !== 'S256' ||
    !/^[A-Za-z0-9_-]{43}$/.test(fields.get('code_challenge') ?? '')
  ) {
    return authorizationError('invalid_request', 'pkce')
  }
  if (fields.get('scope') && fields.get('scope') !== 'read')
    return authorizationError('invalid_scope', 'scope')
  if (sessions.size >= 4) return authorizationError('temporarily_unavailable', 'capacity')
  const upstreamState = nonce()
  const session = {
    upstreamState,
    provider: context.req.param('provider'),
    redirect,
    state: fields.get('state'),
    challenge: fields.get('code_challenge'),
    phase: 'callback',
    deadline: clock + 600000
  }
  sessions.set(upstreamState, session)
  const target = new URL(`${upstreamOrigin}/${session.provider}/authorize`)
  target.search = new URLSearchParams({
    response_type: 'code',
    client_id: 'owned-client',
    redirect_uri: `${relayOrigin}/example/${session.provider}/callback`,
    state: upstreamState,
    code_challenge: session.challenge,
    code_challenge_method: 'S256'
  }).toString()
  return context.redirect(target.href, 302)
})
relay.get('/:application/:provider/callback', (context) => {
  const fields = parseFields(new URL(context.req.url).search)
  const session = sessions.get(fields.get('state'))
  if (
    !session ||
    session.phase !== 'callback' ||
    session.provider !== context.req.param('provider')
  ) {
    return problem('invalid_grant', 'session_unavailable')
  }
  const code = fields.get('code')
  if ((code && fields.has('error')) || (!code && !fields.has('error')))
    return problem('invalid_request', 'callback_result')
  const target = new URL(session.redirect)
  target.searchParams.set('state', session.state)
  if (fields.has('error')) {
    target.searchParams.set(
      'error',
      fields.get('error') === 'access_denied' ? 'access_denied' : 'server_error'
    )
    remove(session)
  } else {
    const codeKey = sha(`${session.provider}\0${code}`)
    if (codes.has(codeKey)) return problem('invalid_grant', 'code_already_bound')
    session.codeKey = codeKey
    session.phase = 'exchange'
    session.deadline = Math.min(session.deadline, clock + 60000)
    codes.set(codeKey, session)
    target.searchParams.set('code', code)
  }
  return context.redirect(target.href, 302)
})
relay.post('/:application/:provider/token', async (context) => {
  if (
    (context.req.header('content-type') ?? '').split(';')[0] !== 'application/x-www-form-urlencoded'
  ) {
    return problem('invalid_request', 'content_type', 415)
  }
  const fields = parseFields(await readBounded(context.req.raw.body, 16384))
  if (fields.get('client_id') !== 'owned-client')
    return problem('invalid_client', 'registration_mismatch')
  const provider = context.req.param('provider')
  const grant = fields.get('grant_type')
  let session
  if (grant === 'authorization_code') {
    session = codes.get(sha(`${provider}\0${fields.get('code')}`))
    if (!session || session.phase !== 'exchange')
      return problem('invalid_grant', 'session_unavailable')
    if (session.redirect !== fields.get('redirect_uri'))
      return problem('invalid_grant', 'redirect_uri')
    const verifier = fields.get('code_verifier') ?? ''
    if (
      !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) ||
      !timingSafeEqual(Buffer.from(challenge(verifier)), Buffer.from(session.challenge))
    ) {
      return problem('invalid_grant', 'pkce_mismatch')
    }
  } else if (grant !== 'refresh_token') {
    return problem('unsupported_grant_type', 'parameters')
  } else if (!fields.get('refresh_token')) {
    return problem('invalid_request', 'parameters')
  }
  if (session) session.phase = 'exchanging'
  const outgoing = new URLSearchParams({
    grant_type: grant,
    client_id: 'owned-client',
    client_secret: 'owned-fixture-secret'
  })
  if (session) {
    outgoing.set('code', fields.get('code'))
    outgoing.set('code_verifier', fields.get('code_verifier'))
    outgoing.set('redirect_uri', `${relayOrigin}/example/${provider}/callback`)
  } else outgoing.set('refresh_token', fields.get('refresh_token'))
  const deadline = AbortSignal.timeout(150)
  try {
    const response = await fetch(`${upstreamOrigin}/${provider}/token`, {
      method: 'POST',
      body: outgoing,
      redirect: 'error',
      signal: AbortSignal.any([deadline, context.req.raw.signal])
    })
    if (response.status === 429) {
      await response.body?.cancel()
      const limited = problem('temporarily_unavailable', 'upstream_rate_limited', 429)
      limited.headers.set('Retry-After', response.headers.get('Retry-After'))
      return limited
    }
    const body = JSON.parse(await readBounded(response.body, 1048576))
    if (!response.ok) return problem('invalid_grant', 'upstream_rejected')
    return context.json(body)
  } catch (error) {
    if (deadline.aborted || context.req.raw.signal.aborted)
      return problem('server_error', 'upstream_result_unknown', 504)
    throw error
  } finally {
    if (session) remove(session)
  }
})

const get = (url) => fetch(url, { redirect: 'manual' })
const post = (provider, fields, options = {}) =>
  fetch(`${relayOrigin}/example/${provider}/token`, {
    method: 'POST',
    body: new URLSearchParams(fields),
    redirect: 'manual',
    ...options
  })

async function begin(provider = 'strict', verifier = nonce()) {
  const state = `owned state + / ${nonce()}`
  const fields = {
    response_type: 'code',
    client_id: 'owned-client',
    redirect_uri: `${clientOrigin}/callback`,
    state,
    scope: 'read',
    code_challenge: challenge(verifier),
    code_challenge_method: 'S256'
  }
  const request = new URL(`${relayOrigin}/example/${provider}/authorize`)
  request.search = new URLSearchParams(fields).toString()
  const response = await get(request)
  assert.equal(response.status, 302)
  const upstream = response.headers.get('Location')
  assert.notEqual(new URL(upstream).searchParams.get('state'), state)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  await response.body?.cancel()
  return { provider, verifier, state, fields, request, upstream }
}

async function issue(operation) {
  const response = await get(operation.upstream)
  assert.equal(response.status, 302)
  const callback = response.headers.get('Location')
  await response.body?.cancel()
  return { ...operation, callback, code: new URL(callback).searchParams.get('code') }
}

async function completeCallback(operation) {
  const response = await get(operation.callback)
  assert.equal(response.status, 302)
  const destination = new URL(response.headers.get('Location'))
  assert.equal(destination.searchParams.get('code'), operation.code)
  assert.equal(destination.searchParams.get('state'), operation.state)
  await response.body?.cancel()
  await (await get(destination)).text()
  return {
    grant_type: 'authorization_code',
    client_id: 'owned-client',
    code: operation.code,
    redirect_uri: operation.fields.redirect_uri,
    code_verifier: operation.verifier
  }
}

try {
  clientOrigin = await listen(callbackApp)
  upstreamOrigin = await listen(upstreamApp)
  relayOrigin = await listen(relay)
  const operation = await issue(await begin())
  const fields = await completeCallback(operation)
  assert.equal(received.at(-1).state, operation.state)
  const beforeInvalid = upstreamCalls
  const invalid = await post('strict', { ...fields, code_verifier: nonce() })
  assert.equal((await invalid.json()).reason, 'pkce_mismatch')
  assert.equal(upstreamCalls, beforeInvalid)
  assert.equal(codes.size, 1)
  const replies = await Promise.all([post('strict', fields), post('strict', fields)])
  assert.deepEqual(replies.map((reply) => reply.status).sort(), [200, 400])
  for (const reply of replies) {
    const body = await reply.json()
    if (reply.ok) assert.deepEqual(body.provider_field, { retained: true })
  }
  assert.equal(upstreamCalls - beforeInvalid, 1)
  assert.equal(sessions.size, 0)
  assert.equal(codes.size, 0)
  assert.equal((await get(operation.callback)).status, 400)
  observations.push({
    scenario: 'loopback, state, invalid verifier and concurrent exchange',
    upstreamExchanges: 1,
    indexesAfter: 0
  })

  const refresh = await post('strict', {
    grant_type: 'refresh_token',
    client_id: 'owned-client',
    refresh_token: 'owned-refresh-token'
  })
  const refreshed = await refresh.json()
  assert.equal(refresh.status, 200)
  assert.equal(Object.hasOwn(refreshed, 'refresh_token'), false)
  assert.equal(sessions.size, 0)
  observations.push({
    scenario: 'refresh without authorization session',
    success: true,
    absentRefreshTokenPreserved: true
  })

  const denied = await begin()
  const denial = new URL(`${relayOrigin}/example/strict/callback`)
  denial.search = new URLSearchParams({
    state: new URL(denied.upstream).searchParams.get('state'),
    error: 'access_denied'
  }).toString()
  const rejection = await get(denial)
  assert.equal(new URL(rejection.headers.get('Location')).searchParams.get('state'), denied.state)
  assert.equal(
    new URL(rejection.headers.get('Location')).searchParams.get('error'),
    'access_denied'
  )
  await rejection.body?.cancel()
  assert.equal(sessions.size, 0)
  const malformed = new URL(denied.request)
  malformed.searchParams.append('client_id', 'another-value')
  assert.equal((await get(malformed)).status, 400)
  malformed.search = new URLSearchParams({
    ...denied.fields,
    redirect_uri: `${clientOrigin.replace('127.0.0.1', '127.1')}/callback`
  }).toString()
  assert.equal((await get(malformed)).status, 400)
  observations.push({
    scenario: 'denial, duplicate parameters and literal loopback matching',
    success: true
  })

  for (let index = 0; index < 4; index++) await begin()
  const full = await get(denied.request)
  assert.equal(full.status, 302)
  assert.equal(
    new URL(full.headers.get('Location')).searchParams.get('error'),
    'temporarily_unavailable'
  )
  assert.equal(new URL(full.headers.get('Location')).searchParams.get('reason'), 'capacity')
  await full.body?.cancel()
  assert.equal(sessions.size, 4)
  clock += 600001
  await (await get(`${relayOrigin}/healthz`)).json()
  assert.equal(sessions.size, 0)
  observations.push({
    scenario: 'capacity and expiry with an injected clock',
    activeSessionsKeptOnFull: 4,
    remainingAfterExpiry: 0
  })

  for (const fault of ['rate-limit', 'slow']) {
    const candidate = await issue(await begin())
    const request = await completeCallback(candidate)
    nextFault = fault
    const before = upstreamCalls
    const response = await post('strict', request)
    const body = await response.json()
    assert.equal(response.status, fault === 'rate-limit' ? 429 : 504)
    assert.equal(
      body.reason,
      fault === 'rate-limit' ? 'upstream_rate_limited' : 'upstream_result_unknown'
    )
    if (fault === 'rate-limit') assert.equal(response.headers.get('Retry-After'), '7')
    const repeated = await post('strict', request)
    assert.equal(repeated.status, 400)
    await repeated.body?.cancel()
    assert.equal(upstreamCalls - before, 1)
    assert.equal(sessions.size, 0)
    observations.push({ scenario: fault, upstreamAttempts: 1, repeatedExchangeRejected: true })
  }

  const candidate = await issue(await begin())
  const request = await completeCallback(candidate)
  nextFault = 'slow'
  const ready = new Promise((resolve) => {
    started = resolve
  })
  const controller = new AbortController()
  const pending = post('strict', request, { signal: controller.signal })
  const rejected = assert.rejects(pending, { name: 'AbortError' })
  await ready
  controller.abort()
  await rejected
  for (let attempt = 0; sessions.size && attempt < 50; attempt++) await delay(10)
  assert.equal(sessions.size, 0)
  observations.push({ scenario: 'HTTP client disconnect', authorizationIndexesReleased: true })

  for (const provider of ['strict', 'unbound']) {
    const first = await issue(await begin(provider))
    const second = await begin(provider)
    const injected = new URL(`${relayOrigin}/example/${provider}/callback`)
    injected.search = new URLSearchParams({
      state: new URL(second.upstream).searchParams.get('state'),
      code: first.code
    }).toString()
    const request = await completeCallback({ ...second, callback: injected.href, code: first.code })
    const response = await post(provider, request)
    assert.equal(response.status, provider === 'strict' ? 400 : 200)
    await response.body?.cancel()
    observations.push({
      scenario: 'code from another authorization, controlled upstream',
      upstreamModel: provider,
      localVerifierAccepted: true,
      upstreamAccepted: response.ok,
      provesRealProviderBehavior: false
    })
    clock += 600001
    await (await get(`${relayOrigin}/healthz`)).json()
  }
  for (let attempt = 0; upstreamAborts < 2 && attempt < 50; attempt++) await delay(10)
  assert.equal(upstreamAborts, 2)
  assert.equal(sessions.size, 0)
  assert.equal(codes.size, 0)
} finally {
  for (const server of servers.reverse()) {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  }
}

const result = {
  checkedAt: new Date().toISOString(),
  node: process.version,
  observations,
  upstreamCalls,
  upstreamAborts,
  loopbackServersClosed: servers.every((server) => !server.listening),
  sourceReceiptSha256: sha(readFileSync(new URL('source-input.json', here))),
  probeSha256: sha(readFileSync(fileURLToPath(import.meta.url))),
  realProviderAuthorizationExecuted: false,
  realCredentialsUsed: false,
  publicServiceChanged: false,
  productionRelayImplemented: false,
  containerImageBuilt: false,
  composeExecuted: false
}
writeFileSync(new URL('protocol-contract.json', here), `${JSON.stringify(result, null, 2)}\n`)
process.stdout.write(
  `${JSON.stringify({ scenarios: observations.length, upstreamCalls, upstreamAborts, loopbackServersClosed: result.loopbackServersClosed })}\n`
)
