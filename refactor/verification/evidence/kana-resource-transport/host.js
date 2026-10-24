// Browser-side owner used by both HTTP browsers and a hidden Electron window.
const mounts = new Map()
const reads = []
const pending = new Set()
let registration
let ownerId
let workerUrl

navigator.serviceWorker.addEventListener('message', async (event) => {
  if (event.source?.scriptURL !== workerUrl || event.data?.type !== 'resource') return
  const { token, path, search } = event.data
  const port = event.ports[0]
  const mount = mounts.get(token)
  if (!mount) {
    port.postMessage({ status: 410 })
    port.close()
    return
  }
  const task = {}
  pending.add(task)
  try {
    reads.push({ token, path })
    if (path === '/book/slow.css') {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 5000)
        mount.signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer)
            resolve()
          },
          { once: true }
        )
      })
    }
    if (mount.signal.aborted) {
      port.postMessage({ status: 410 })
      return
    }
    const entry = mount.files[path]
    const body =
      path === '/book/chapter.xhtml'
        ? mount.chapters[new URLSearchParams(search).get('type') || 'html']
        : entry?.body
    if (body === undefined) {
      port.postMessage({ status: 404 })
      return
    }
    const type =
      path === '/book/chapter.xhtml'
        ? new URLSearchParams(search).get('type') === 'xhtml'
          ? 'application/xhtml+xml'
          : 'text/html; charset=utf-8'
        : entry.type
    const root = registration.scope
    const headers = {
      'Content-Type': type,
      'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline' ${root}; img-src ${root}; font-src ${root}; base-uri 'none'; form-action 'none'; frame-ancestors 'self'`
    }
    port.postMessage({ status: 200, body, headers })
  } finally {
    pending.delete(task)
    port.close()
  }
})

async function prepareTransport() {
  workerUrl = new URL('/kana-content/worker.js', location.href).href
  registration = await navigator.serviceWorker.register(workerUrl, {
    scope: '/kana-content/',
    updateViaCache: 'none'
  })
  const worker = registration.active || registration.installing || registration.waiting
  if (worker.state !== 'activated') {
    await new Promise((resolve, reject) => {
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') resolve()
        if (worker.state === 'redundant') reject(new Error('Probe worker did not activate.'))
      })
    })
  }
  const identity = await new Promise((resolve) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = ({ data }) => {
      channel.port1.close()
      resolve(data)
    }
    registration.active.postMessage({ type: 'identify' }, [channel.port2])
  })
  ownerId = identity.ownerId
  return {
    secure: isSecureContext,
    ownerControlled: navigator.serviceWorker.controller !== null,
    scope: registration.scope,
    bootId: identity.bootId
  }
}

function mountFixture(files, chapters) {
  const token = crypto.randomUUID()
  const controller = new AbortController()
  const base = new URL(`/kana-content/${ownerId}/${token}/`, location.href).href
  mounts.set(token, { files, chapters, base, signal: controller.signal, controller })
  return { token, base }
}

function closeMount(token) {
  const mount = mounts.get(token)
  if (!mount) return
  mounts.delete(token)
  mount.controller.abort()
}

function mountFrame(url, width = 340) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe')
    frame.width = String(width)
    frame.height = '480'
    frame.style.border = '0'
    const timeout = setTimeout(() => reject(new Error('Probe frame did not load.')), 15000)
    frame.onload = () => {
      clearTimeout(timeout)
      resolve(frame)
    }
    frame.src = url
    document.body.append(frame)
  })
}

function inspect(frame) {
  const doc = frame.contentDocument
  const win = frame.contentWindow
  const style = (id) => win.getComputedStyle(doc.getElementById(id))
  const root = new URL('./', doc.URL).href
  const target = style('target')
  return {
    controlled: win.navigator.serviceWorker.controller?.scriptURL === workerUrl,
    values: {
      color: target.color,
      fontSize: target.fontSize,
      padding: target.paddingInlineStart,
      border: target.borderBlockEndWidth,
      imageOutline: style('image').outline,
      imageWidth: doc.getElementById('image').naturalWidth,
      linkThickness: style('link').textDecorationThickness,
      linkWidth: doc.getElementById('link').getBoundingClientRect().width,
      svgFill: style('rect').fill,
      svgOpacity: style('use').opacity,
      custom: style('custom').backgroundImage.replaceAll(root, '/book/'),
      inline: style('inline-custom').backgroundImage.replaceAll(root, '/book/'),
      registered: style('registered').backgroundImage.replaceAll(root, '/book/'),
      writingMode: target.writingMode,
      text: doc.body.textContent,
      attributes: [...doc.body.querySelectorAll('*')].map((element) =>
        [...element.attributes].map((attribute) => [
          attribute.namespaceURI,
          attribute.name,
          attribute.value
        ])
      )
    }
  }
}

async function finishTransport() {
  for (const token of mounts.keys()) closeMount(token)
  for (const frame of document.querySelectorAll('iframe')) frame.remove()
  const unregistered = await registration.unregister()
  return { unregistered, mounts: mounts.size, pending: pending.size, caches: await caches.keys() }
}

async function runCases(data) {
  const setup = await prepareTransport()
  const cases = []
  for (const [index, sample] of data.samples.entries()) {
    const mount = mountFixture(data.files, sample.chapters)
    const width = index % 2 ? 640 : 340
    const [reference, routed] = await Promise.all([
      mountFrame(`/reference/${index}/book/chapter.xhtml?type=${sample.type}`, width),
      mountFrame(`${mount.base}book/chapter.xhtml?type=${sample.type}`, width)
    ])
    const source = inspect(reference)
    const transported = inspect(routed)
    if (JSON.stringify(source.values) !== JSON.stringify(transported.values)) {
      const differences = Object.keys(source.values).filter(
        (key) => JSON.stringify(source.values[key]) !== JSON.stringify(transported.values[key])
      )
      throw new Error(
        `Transport changed fixture ${index}: ` +
          JSON.stringify(
            differences.map((key) => ({
              key,
              source: source.values[key],
              routed: transported.values[key]
            }))
          )
      )
    }
    if (!transported.controlled || source.controlled) {
      throw new Error('The expected content scope was not applied.')
    }
    cases.push({
      mode: sample.mode,
      type: sample.type,
      width,
      source,
      transported,
      resources: [
        ...new Set(reads.filter((read) => read.token === mount.token).map((r) => r.path))
      ].sort()
    })
    console.info(`transport-case:${index}`)
    reference.remove()
    routed.remove()
    closeMount(mount.token)
  }
  const sample = data.samples[0]
  const first = mountFixture(data.files, sample.chapters)
  const second = mountFixture(data.files, sample.chapters)
  const firstFrame = await mountFrame(`${first.base}book/chapter.xhtml`)
  const secondFrame = await mountFrame(`${second.base}book/chapter.xhtml`)
  // Element loads exercise the same native path as book styles and images.
  const elementLoad = (frame, tag, url) =>
    new Promise((resolve) => {
      const element = frame.contentDocument.createElement(tag)
      const finish = (loaded) => {
        clearTimeout(timeout)
        element.remove()
        resolve(loaded)
      }
      const timeout = setTimeout(() => finish('timeout'), 10000)
      element.onload = () => finish(true)
      element.onerror = () => finish(false)
      if (tag === 'link') {
        element.rel = 'stylesheet'
        element.href = url
      } else {
        element.src = url
      }
      frame.contentDocument.body.append(element)
    })
  const crossMount = await elementLoad(
    firstFrame,
    'img',
    `${second.base}book/art/paper.svg?cross=1`
  )
  const outside = await elementLoad(firstFrame, 'img', new URL('/outside.svg', location.href).href)
  if (crossMount !== false || outside !== false) {
    throw new Error('A content document escaped its resource mount.')
  }
  console.info('transport-boundaries:passed')
  const slow = elementLoad(firstFrame, 'link', `${first.base}book/slow.css`)
  for (
    let i = 0;
    i < 100 && !reads.some((r) => r.token === first.token && r.path.endsWith('slow.css'));
    i++
  ) {
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  if (!pending.size) throw new Error('The slow resource did not reach its owner.')
  closeMount(first.token)
  const slowLoaded = await slow
  const closedHasContent = await elementLoad(
    firstFrame,
    'img',
    `${first.base}book/art/paper.svg?closed=1`
  )
  const survivor = inspect(secondFrame)
  if (
    slowLoaded !== false ||
    closedHasContent !== false ||
    !survivor.values.text.startsWith('ABC') ||
    pending.size
  ) {
    throw new Error('Closing one mount did not preserve the expected ownership.')
  }
  // Keep the surviving mount for the Chromium worker-restart check.
  firstFrame.remove()
  return {
    setup,
    cases,
    lifecycle: {
      crossMountLoaded: crossMount,
      outsideLoaded: outside,
      slowLoadedAfterClose: slowLoaded,
      closedHasContent,
      pendingAfterClose: pending.size,
      otherMountStillReadable: survivor.values.imageWidth === 10
    },
    survivor: second
  }
}

async function readAfterRestart(survivor) {
  const frame = await mountFrame(`${survivor.base}book/chapter.xhtml?restart=1`)
  const result = inspect(frame)
  const channel = new MessageChannel()
  const identity = await new Promise((resolve) => {
    channel.port1.onmessage = ({ data }) => {
      channel.port1.close()
      resolve(data)
    }
    registration.active.postMessage({ type: 'identify' }, [channel.port2])
  })
  frame.remove()
  return { identity, readable: result.values.imageWidth === 10, controlled: result.controlled }
}

globalThis.probe = {
  prepareTransport,
  mountFixture,
  mountFrame,
  inspect,
  closeMount,
  finishTransport,
  runCases,
  readAfterRestart,
  reads,
  pending,
  mounts
}
