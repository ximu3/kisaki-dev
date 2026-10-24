const fs = require('node:fs')
const path = require('node:path')
const { app, BrowserWindow, protocol, session } = require('electron')

const profile = path.join(__dirname, 'webview-profile')
fs.mkdirSync(profile, { recursive: true })
app.setPath('userData', profile)
app.setPath('sessionData', profile)
app.disableHardwareAcceleration()
protocol.registerSchemesAsPrivileged(
  ['kisaki-probe', 'kisaki-extension', 'kisaki-resource'].map((scheme) => ({
    scheme,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      bypassCSP: false,
      allowServiceWorkers: false,
      allowExtensions: false
    }
  }))
)

const parentOrigin = 'kisaki-probe://native'
const viewOrigin = (id) => `kisaki-extension://view-${id}`
const broadResourcePolicy = process.argv.includes('--broad-resource-policy')
const childPolicy = (id) => {
  const resourceOrigin = broadResourcePolicy ? 'kisaki-resource:' : `kisaki-resource://scope-${id}`
  return [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https: ${resourceOrigin}`,
    `font-src 'self' data: ${resourceOrigin}`,
    `media-src 'self' blob: https: ${resourceOrigin}`,
    `connect-src 'self' https: wss: ${resourceOrigin}`,
    "worker-src 'self'",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    `frame-ancestors ${parentOrigin} ${viewOrigin(id)}`
  ].join('; ')
}

const evidence = {
  requests: [],
  handled: [],
  permissions: [],
  navigations: [],
  failedLoads: [],
  popups: [],
  console: []
}
const resourceUrl = 'kisaki-resource://scope-a/value'

function reply(body, type, policy) {
  return new Response(body, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(policy ? { 'Content-Security-Policy': policy } : {})
    }
  })
}

app.whenReady().then(async () => {
  const browserSession = session.fromPartition(`webview-probe-${process.pid}`)
  browserSession.setPermissionCheckHandler((_contents, permission, requestingOrigin, details) => {
    evidence.permissions.push({
      phase: 'check',
      permission,
      requestingOrigin,
      isMainFrame: details.isMainFrame
    })
    return false
  })
  browserSession.setPermissionRequestHandler((_contents, permission, callback, details) => {
    evidence.permissions.push({
      phase: 'request',
      permission,
      requestingUrl: details.requestingUrl,
      isMainFrame: details.isMainFrame
    })
    callback(false)
  })
  browserSession.webRequest.onBeforeRequest((details, callback) => {
    let frameUrl = null
    try {
      frameUrl = details.frame?.url ?? null
    } catch {}
    const cancel =
      details.url.startsWith('kisaki-resource:') && frameUrl !== `${viewOrigin('a')}/entry.html`
    evidence.requests.push({
      url: details.url,
      resourceType: details.resourceType,
      frameUrl,
      cancel
    })
    callback({ cancel })
  })
  browserSession.protocol.handle('kisaki-probe', (request) => {
    const url = new URL(request.url)
    if (url.hostname !== 'native') return new Response(null, { status: 404 })
    if (url.pathname === '/parent.js')
      return reply(fs.readFileSync(path.join(__dirname, 'webview-parent.js')), 'text/javascript')
    if (url.pathname !== '/index.html') return new Response(null, { status: 404 })
    // The geolocation grant is test-only: it lets the session denial run independently of Permissions Policy.
    const html = `<html><head><script src="/parent.js" defer></script></head><body><div id="native-secret">native only</div><iframe id="a" name="a" sandbox="allow-scripts allow-same-origin" allow="geolocation" src="${viewOrigin('a')}/entry.html"></iframe><iframe id="b" name="b" sandbox="allow-scripts allow-same-origin" src="${viewOrigin('b')}/entry.html"></iframe></body></html>`
    return reply(
      html,
      'text/html',
      "default-src 'none'; script-src 'self'; frame-src kisaki-extension:; style-src 'self' 'unsafe-inline'"
    )
  })
  browserSession.protocol.handle('kisaki-extension', (request) => {
    evidence.handled.push({ url: request.url, origin: request.headers.get('Origin') })
    const url = new URL(request.url)
    if (!['view-a', 'view-b'].includes(url.hostname)) return new Response(null, { status: 404 })
    const policy = childPolicy(url.hostname.slice('view-'.length))
    if (['/entry.html', '/next.html'].includes(url.pathname)) {
      return reply(
        '<html><head><script>window.inlineExecuted = true</script><script src="/child.js" defer></script></head><body>Package page</body></html>',
        'text/html',
        policy
      )
    }
    if (url.pathname === '/child.js')
      return reply(
        fs.readFileSync(path.join(__dirname, 'webview-child.js')),
        'text/javascript',
        policy
      )
    if (url.pathname === '/worker.js')
      return reply(
        "fetch('kisaki-resource://scope-a/value?worker').then(r => r.text()).then(value => postMessage({ packageWorker: true, resource: value }), () => postMessage({ packageWorker: true, resourceDenied: true }))",
        'text/javascript',
        policy
      )
    if (url.pathname === '/data.json')
      return reply('{"packageData":true}', 'application/json', policy)
    return new Response(null, { status: 404 })
  })
  browserSession.protocol.handle('kisaki-resource', (request) => {
    evidence.handled.push({ url: request.url, origin: request.headers.get('Origin') })
    return new Response('owned resource', {
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      }
    })
  })
  // Synthetic HTTPS responses test CSP data reachability without contacting an external service.
  browserSession.protocol.handle('https', (request) => {
    evidence.handled.push({ url: request.url, origin: request.headers.get('Origin') })
    if (new URL(request.url).hostname !== 'fixture.test') return new Response(null, { status: 404 })
    return new Response(
      new URL(request.url).pathname.endsWith('.js')
        ? 'window.remoteExecuted = true'
        : '{"remoteData":true}',
      {
        headers: {
          'Content-Type': new URL(request.url).pathname.endsWith('.js')
            ? 'text/javascript'
            : 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store'
        }
      }
    )
  })

  const window = new BrowserWindow({
    show: false,
    width: 1000,
    height: 800,
    webPreferences: {
      session: browserSession,
      preload: path.join(__dirname, 'webview-preload.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      backgroundThrottling: false,
      offscreen: true
    }
  })
  window.webContents.on('console-message', (details) => {
    evidence.console.push({
      level: details.level,
      message: details.message,
      sourceId: details.sourceId
    })
  })
  window.webContents.setWindowOpenHandler((details) => {
    evidence.popups.push(details.url)
    return { action: 'deny' }
  })
  const checkNavigation = (details) => {
    const source = details.frame?.url ?? null
    const target = new URL(details.url)
    const initial =
      !source &&
      ['a', 'b'].includes(details.frame?.name) &&
      details.frame?.parent === window.webContents.mainFrame &&
      details.url === `${viewOrigin(details.frame.name)}/entry.html`
    const allowed =
      initial ||
      (source?.startsWith('kisaki-extension://') &&
        target.protocol === 'kisaki-extension:' &&
        target.hostname === new URL(source).hostname &&
        ['/entry.html', '/next.html'].includes(target.pathname))
    evidence.navigations.push({
      source,
      target: details.url,
      allowed: Boolean(allowed),
      isMainFrame: details.isMainFrame
    })
    if (!allowed) details.preventDefault()
  }
  window.webContents.on('will-frame-navigate', checkNavigation)
  window.webContents.on('will-redirect', checkNavigation)
  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      evidence.failedLoads.push({ errorCode, errorDescription, validatedURL, isMainFrame })
    }
  )

  let state
  let failure
  try {
    await window.loadURL(`${parentOrigin}/index.html`)
    const deadline = Date.now() + 20000
    do {
      state = await window.webContents.executeJavaScript('window.probeState')
      if (state?.status !== 'running') {
        await new Promise((resolve) => setTimeout(resolve, 150))
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 50))
    } while (Date.now() < deadline)
  } catch (error) {
    failure = { name: error.name, message: error.message, stack: error.stack }
  }
  const checks = {
    renderer: state?.status === 'passed',
    actualFrameAuthorized: evidence.requests.some(
      (item) =>
        item.url === resourceUrl &&
        item.frameUrl === `${viewOrigin('a')}/entry.html` &&
        !item.cancel
    ),
    wrongViewDenied: state?.reports.b?.wrongResourceDenied === true,
    workerCrossViewDenied: state?.reports.b?.worker?.resourceDenied === true,
    remoteScriptNeverRequested: !evidence.handled.some(
      (item) => item.url === 'https://fixture.test/remote.js'
    ),
    httpNeverRequested: !evidence.requests.some((item) => item.url.startsWith('http:')),
    externalNavigationDenied: evidence.failedLoads.some(
      (item) =>
        item.validatedURL === 'https://fixture.test/external' &&
        item.errorDescription === 'ERR_BLOCKED_BY_CSP'
    ),
    otherViewNavigationDenied: evidence.navigations.some(
      (item) =>
        item.target === `${viewOrigin('b')}/entry.html` &&
        item.source === `${viewOrigin('a')}/entry.html` &&
        !item.allowed
    ),
    packageNavigationAllowed: evidence.navigations.some(
      (item) => item.target === `${viewOrigin('a')}/next.html` && item.allowed
    ),
    permissionCheckDenied: evidence.permissions.some(
      (item) => item.phase === 'check' && item.permission === 'geolocation'
    ),
    permissionRequestDenied: evidence.permissions.some(
      (item) => item.phase === 'request' && item.permission === 'geolocation'
    )
  }
  const passed = !failure && Object.values(checks).every(Boolean)
  fs.writeFileSync(
    path.join(
      __dirname,
      broadResourcePolicy ? 'webview-broad-resource-results.json' : 'webview-results.json'
    ),
    JSON.stringify(
      {
        versions: process.versions,
        broadResourcePolicy,
        childPolicies: { a: childPolicy('a'), b: childPolicy('b') },
        checks,
        passed,
        state,
        failure,
        evidence
      },
      null,
      2
    )
  )
  window.destroy()
  app.exit(passed ? 0 : 1)
})
