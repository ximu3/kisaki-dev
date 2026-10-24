// Authorized, temporary provider verification. Credentials remain in memory.
import { createServer } from 'node:http'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const definitions = {
  anilist: {
    authorize: 'https://anilist.co/api/v2/oauth/authorize',
    token: 'https://anilist.co/api/v2/oauth/token',
    json: true
  },
  bangumi: {
    authorize: 'https://bgm.tv/oauth/authorize',
    token: 'https://bgm.tv/oauth/access_token',
    json: false
  }
}
const errorNames = new Set([
  'invalid_request',
  'invalid_client',
  'invalid_grant',
  'unauthorized_client',
  'unsupported_grant_type',
  'unsupported_response_type',
  'invalid_scope',
  'access_denied',
  'server_error',
  'temporarily_unavailable'
])
const makeValue = () => randomBytes(32).toString('base64url')
const hash = (value) => createHash('sha256').update(value).digest('hex')
const same = (a, b) => {
  if (typeof a !== 'string') return false
  const encoder = new TextEncoder()
  const left = encoder.encode(a)
  const right = encoder.encode(b)
  return left.byteLength === right.byteLength && timingSafeEqual(left, right)
}

export async function createLiveProbe(outputPath, port = 0) {
  const credentials = new Map()
  const results = new Map()
  const controller = new AbortController()
  let active = null
  let origin
  let closed = false
  const moduleSha256 = hash(await readFile(new URL(import.meta.url)))
  const document = () => ({
    checkedAt: new Date().toISOString(),
    runtime: 'cua_repl Node runtime',
    moduleSha256,
    purpose: 'Authorized provider binding verification, not a production relay',
    providers: [...results.values()],
    listenerClosed: closed,
    realProviderOperationsExecuted: [...results.values()].some((row) => row.cases.length > 0),
    personalRecordsModified: false,
    deploymentChanged: false,
    credentialsPersisted: false
  })
  const save = () => writeFile(outputPath, `${JSON.stringify(document(), null, 2)}\n`)
  const html = (response, status, body) => {
    response.writeHead(status, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'"
    })
    response.end(
      `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>OAuth 核验</title><body>${body}</body></html>`
    )
  }
  const redirect = (response, address) => {
    response.writeHead(303, {
      Location: address,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer'
    })
    response.end()
  }

  async function callToken(provider, body) {
    const definition = definitions[provider]
    const deadline = AbortSignal.timeout(15000)
    const started = Date.now()
    try {
      const response = await fetch(definition.token, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.any([deadline, controller.signal]),
        headers: {
          'Content-Type': definition.json
            ? 'application/json'
            : 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'Kisaki-Design-Verification/0.0 (https://github.com/ximu3/kisaki)'
        },
        body: definition.json ? JSON.stringify(body) : new URLSearchParams(body)
      })
      const reader = response.body?.getReader()
      const chunks = []
      let size = 0
      if (reader) {
        try {
          for (;;) {
            const { value, done } = await reader.read()
            if (done) break
            size += value.byteLength
            if (size > 1048576) {
              await reader.cancel()
              return { observation: { httpStatus: response.status, result: 'response_too_large' } }
            }
            chunks.push(value)
          }
        } finally {
          reader.releaseLock()
        }
      }
      let value
      try {
        const bytes = new Uint8Array(size)
        let offset = 0
        for (const chunk of chunks) {
          bytes.set(chunk, offset)
          offset += chunk.byteLength
        }
        value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
      } catch {
        return { observation: { httpStatus: response.status, result: 'non_json_response' } }
      }
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { observation: { httpStatus: response.status, result: 'invalid_json_shape' } }
      }
      const tokenIssued =
        response.ok && typeof value.access_token === 'string' && value.access_token.length > 0
      const observation = {
        httpStatus: response.status,
        result: tokenIssued ? 'token_issued' : 'token_not_issued',
        error: typeof value.error === 'string' && errorNames.has(value.error) ? value.error : null,
        tokenFields: {
          accessToken: typeof value.access_token === 'string' && value.access_token.length > 0,
          refreshToken: typeof value.refresh_token === 'string' && value.refresh_token.length > 0,
          tokenType: typeof value.token_type === 'string',
          expiresIn: typeof value.expires_in === 'number'
        },
        elapsedMs: Date.now() - started
      }
      if (tokenIssued && Number.isFinite(value.expires_in))
        observation.expiresInSeconds = value.expires_in
      return { observation, refreshToken: tokenIssued ? value.refresh_token : undefined }
    } catch {
      return {
        observation: {
          result: controller.signal.aborted
            ? 'cancelled'
            : deadline.aborted
              ? 'timeout'
              : 'transport_failed',
          elapsedMs: Date.now() - started
        }
      }
    }
  }

  async function handle(request, response) {
    const url = new URL(request.url, origin)
    const segments = url.pathname.split('/').filter(Boolean)
    const [provider, operation] = segments
    if (request.method !== 'GET' || !credentials.has(provider) || segments.length !== 2) {
      html(response, 404, '<h1>没有可用的核验入口</h1>')
      return
    }
    const registration = credentials.get(provider)
    const result = results.get(provider)
    if (operation === 'start') {
      if (active) {
        html(response, 409, '<h1>已有授权正在进行</h1><p>请完成当前页面，不要重复开始。</p>')
        return
      }
      const mode = ['correct', 'mismatched', 'omitted'][result.cases.length]
      if (!mode) {
        redirect(response, `${origin}/${provider}/result`)
        return
      }
      const verifier = makeValue()
      active = {
        provider,
        mode,
        verifier,
        state: makeValue(),
        started: Date.now(),
        phase: 'callback'
      }
      const destination = new URL(definitions[provider].authorize)
      destination.search = new URLSearchParams({
        response_type: 'code',
        client_id: registration.clientId,
        redirect_uri: `${origin}/${provider}/callback`,
        state: active.state,
        code_challenge: createHash('sha256').update(verifier, 'ascii').digest('base64url'),
        code_challenge_method: 'S256'
      }).toString()
      redirect(response, destination.href)
      return
    }
    if (operation === 'callback') {
      const state = url.searchParams.get('state')
      if (
        !active ||
        active.provider !== provider ||
        active.phase !== 'callback' ||
        url.searchParams.getAll('state').length !== 1 ||
        !same(state, active.state)
      ) {
        html(response, 400, '<h1>授权回调没有匹配当前核验</h1><p>该请求没有进入令牌交换。</p>')
        return
      }
      active.phase = 'exchange'
      const current = active
      const code = url.searchParams.get('code')
      const observation = {
        mode: current.mode,
        stateMatched: true,
        challengeMethod: 'S256',
        verifierSent: current.mode !== 'omitted',
        authorizationElapsedMs: Date.now() - current.started
      }
      if (url.searchParams.has('error') || !code || url.searchParams.getAll('code').length !== 1) {
        observation.authorizationResult = errorNames.has(url.searchParams.get('error'))
          ? url.searchParams.get('error')
          : 'invalid_callback'
      } else {
        const body = {
          grant_type: 'authorization_code',
          client_id: registration.clientId,
          client_secret: registration.clientSecret,
          code,
          redirect_uri: `${origin}/${provider}/callback`
        }
        if (current.mode !== 'omitted')
          body.code_verifier = current.mode === 'correct' ? current.verifier : makeValue()
        const exchange = await callToken(provider, body)
        observation.exchange = exchange.observation
        if (
          current.mode === 'correct' &&
          typeof exchange.refreshToken === 'string' &&
          exchange.refreshToken
        ) {
          const refreshBody = {
            grant_type: 'refresh_token',
            client_id: registration.clientId,
            client_secret: registration.clientSecret,
            refresh_token: exchange.refreshToken
          }
          if (provider === 'bangumi') refreshBody.redirect_uri = `${origin}/${provider}/callback`
          observation.refresh = (await callToken(provider, refreshBody)).observation
        }
      }
      result.cases.push(observation)
      active = null
      await save()
      redirect(response, `${origin}/${provider}/result`)
      return
    }
    if (operation === 'result') {
      const finished = result.cases.length
      const next =
        finished < 3
          ? `<p><a href="/${provider}/start">继续第 ${finished + 1} 组授权核验</a></p>`
          : '<p>该来源的三组核验已完成，可以关闭此页。</p>'
      html(
        response,
        200,
        `<h1>${provider} 授权核验</h1><p>已记录 ${finished} / 3 组结果。</p>${next}<p>此页不显示授权码、令牌或应用秘密。</p>`
      )
      return
    }
    html(response, 404, '<h1>没有可用的核验入口</h1>')
  }

  const server = createServer((request, response) => {
    handle(request, response).catch(async () => {
      if (active) {
        results.get(active.provider).cases.push({ mode: active.mode, result: 'probe_failed' })
        active = null
      }
      await save()
      if (!response.headersSent)
        html(response, 500, '<h1>本次核验未完成</h1><p>没有自动重复交换。</p>')
      else response.end()
    })
  })
  server.requestTimeout = 30000
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  origin = `http://127.0.0.1:${server.address().port}`
  return {
    register(provider, clientId, clientSecret, originalCallback) {
      if (
        !Object.hasOwn(definitions, provider) ||
        !clientId ||
        !clientSecret ||
        credentials.has(provider)
      )
        throw new Error('Invalid provider test registration.')
      credentials.set(provider, { clientId, clientSecret, originalCallback })
      results.set(provider, {
        provider,
        clientType: 'existing confidential client',
        cases: [],
        registrationChanged: false,
        originalCallbackRestored: false
      })
      return { callback: `${origin}/${provider}/callback`, start: `${origin}/${provider}/start` }
    },
    async markRegistrationChanged(provider) {
      results.get(provider).registrationChanged = true
      await save()
    },
    async markRestored(provider, callback) {
      if (credentials.get(provider)?.originalCallback !== callback)
        throw new Error('Original callback has not been restored.')
      results.get(provider).originalCallbackRestored = true
      await save()
    },
    status() {
      return {
        active: active
          ? { provider: active.provider, mode: active.mode, phase: active.phase }
          : null,
        providers: [...results.values()].map((value) => ({
          provider: value.provider,
          completed: value.cases.length,
          restored: value.originalCallbackRestored
        }))
      }
    },
    async close() {
      controller.abort()
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
      active = null
      credentials.clear()
      closed = true
      await save()
      return { listenerClosed: true }
    }
  }
}
