const parentOrigin = 'kisaki-probe://native'
const resourceUrl = 'kisaki-resource://scope-a/value'
const violations = []
window.addEventListener('securitypolicyviolation', (event) =>
  violations.push(event.violatedDirective)
)

function blocked(action) {
  try {
    action()
    return false
  } catch {
    return true
  }
}

function loadScript(url) {
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = url
    script.onload = () => {
      script.remove()
      resolve(true)
    }
    script.onerror = () => {
      script.remove()
      resolve(false)
    }
    document.head.append(script)
  })
}

function runWorker() {
  return new Promise((resolve, reject) => {
    const worker = new Worker('/worker.js')
    worker.onmessage = ({ data }) => {
      worker.terminate()
      resolve(data)
    }
    worker.onerror = (error) => {
      worker.terminate()
      reject(error)
    }
  })
}

async function run(port) {
  if (location.pathname === '/next.html') {
    port.postMessage({ reloaded: true })
    return
  }
  if (location.hostname === 'view-b') {
    parent.postMessage({ type: 'probe-result', owner: 'a', checks: { forged: true } }, parentOrigin)
    let wrongResourceDenied = false
    try {
      await fetch(resourceUrl)
    } catch {
      wrongResourceDenied = true
    }
    port.postMessage({ wrongResourceDenied, worker: await runWorker() })
    setTimeout(() => {
      location.href = 'https://fixture.test/external'
    }, 0)
    return
  }
  const checks = {
    originHasHost: location.origin === 'kisaki-extension://view-a',
    noNodeGlobals:
      typeof require === 'undefined' &&
      typeof process === 'undefined' &&
      typeof Buffer === 'undefined',
    noNativeBridge: typeof window.nativeProbe === 'undefined',
    parentDomDenied: blocked(() => parent.document.getElementById('native-secret')),
    siblingDomDenied: blocked(() => parent.frames[1].document.body),
    inlineScriptDenied: window.inlineExecuted === undefined,
    evalDenied: blocked(() => window.eval('1 + 1')),
    popupDenied: window.open('https://fixture.test/popup') === null,
    topNavigationDenied: blocked(() => {
      top.location.href = 'https://fixture.test/top'
    })
  }
  checks.packageData = (await (await fetch('/data.json')).json()).packageData === true
  checks.httpsData =
    (await (await fetch('https://fixture.test/data.json')).json()).remoteData === true
  checks.ownedResource = (await (await fetch(resourceUrl)).text()) === 'owned resource'
  checks.remoteScriptDenied =
    !(await loadScript('https://fixture.test/remote.js')) && window.remoteExecuted === undefined
  const blobUrl = URL.createObjectURL(
    new Blob(['window.blobExecuted = true'], { type: 'text/javascript' })
  )
  checks.blobScriptDenied = !(await loadScript(blobUrl)) && window.blobExecuted === undefined
  URL.revokeObjectURL(blobUrl)
  try {
    await fetch('http://fixture.test/data.json')
    checks.httpDenied = false
  } catch {
    checks.httpDenied = true
  }
  const worker = await runWorker()
  checks.workerPackage = worker.packageWorker === true
  checks.workerOwnedResource = worker.resource === 'owned resource'
  try {
    await navigator.serviceWorker.register('/worker.js')
    checks.serviceWorkerDenied = false
  } catch {
    checks.serviceWorkerDenied = true
  }
  checks.geolocationQueryDenied =
    (await navigator.permissions.query({ name: 'geolocation' })).state === 'denied'
  checks.geolocationRequestDenied = await new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      () => resolve(false),
      (error) => resolve(error.code === 1),
      { timeout: 2000 }
    )
  )
  port.onmessage = async ({ data }) => {
    if (data.type !== 'navigate') return
    location.href = 'kisaki-extension://view-b/entry.html'
    await new Promise((resolve) => setTimeout(resolve, 100))
    if (location.pathname !== '/entry.html') return
    location.href = '/next.html'
  }
  port.postMessage({ checks, violations, worker })
}

window.addEventListener(
  'message',
  (event) => {
    if (
      event.source !== parent ||
      event.origin !== parentOrigin ||
      event.data?.type !== 'port' ||
      event.ports.length !== 1
    )
      return
    const port = event.ports[0]
    run(port).catch((error) =>
      port.postMessage({ failed: true, name: error.name, message: error.message })
    )
  },
  { once: true }
)
parent.postMessage({ type: 'ready' }, parentOrigin)
