// Exercise native fetch separately from the bridge's own pull and cancellation guarantees.
async function runStreamCases() {
  const p = runtimeProbe
  const results = {}
  const initial = await p.prepare('v1')
  const directSource = p.source({ size: 8 * 1024 * 1024, delay: 5 })
  const directOwner = new AbortController()
  const directChannel = new MessageChannel()
  const controlChannel = new MessageChannel()
  directSource.stats.leases++
  const directTransfer = byteBridge.serveBytes(
    directChannel.port1,
    directSource,
    directOwner.signal,
    p.budget,
    directSource.stats,
    async () => {
      directSource.stats.leases--
    }
  )
  p.registrations
    .get('v1')
    .active.postMessage({ type: 'direct-stream' }, [controlChannel.port2, directChannel.port2])
  const command = (message) =>
    new Promise((resolve) => {
      controlChannel.port1.onmessage = ({ data }) => resolve(data)
      controlChannel.port1.postMessage(message)
    })
  await p.wait(50)
  p.check(directSource.stats.reads === 0, 'An unconsumed stream pulled source bytes.')
  const first = await command({ type: 'pull' })
  p.check(
    first.value.byteLength === byteBridge.CHUNK_BYTES,
    'The first chunk has an unexpected size.'
  )
  await p.wait(100)
  p.check(directSource.stats.reads === 1, 'The bridge read ahead while its consumer was paused.')
  await command({ type: 'cancel' })
  await directTransfer.ended
  controlChannel.port1.close()
  results.directPull = { ...directSource.stats }
  console.info('runtime-case:direct-pull')

  const normal = await p.mount('v1', { size: 2 * 1024 * 1024 })
  const normalFrame = await p.frameAt(`${normal.base}book/index.html`)
  p.check(
    normalFrame.contentWindow.getComputedStyle(normalFrame.contentDocument.getElementById('ready'))
      .color === 'rgb(12, 34, 56)',
    'Streamed nested styles did not load.'
  )
  const response = await normalFrame.contentWindow.fetch(`${normal.base}book/data.bin`)
  const reader = response.body.getReader()
  let consumed = 0
  for (;;) {
    const next = await reader.read()
    if (next.done) break
    for (let i = 0; i < next.value.length; i++) {
      p.check(next.value[i] === (consumed + i) % 251, 'Streamed bytes changed.')
    }
    consumed += next.value.length
  }
  const normalSource = p.mounts.get(normal.token).files.get('/book/data.bin')
  await p.until(() => normalSource.stats.leases === 0, 'A completed source remained held.')
  p.check(consumed === normalSource.size, 'The native response ended early.')
  results.complete = { consumed, ...normalSource.stats }
  await p.close(normal.token)
  normalFrame.remove()
  console.info('runtime-case:complete')

  const shared = await p.mount('v1', { size: 1024 * 1024, delay: 2 })
  const sharedValue = p.mounts.get(shared.token)
  const sharedSource = sharedValue.files.get('/book/data.bin')
  sharedValue.files.set('/book/other.bin', sharedSource)
  const sharedFrame = await p.frameAt(`${shared.base}book/index.html`)
  const [one, two] = await Promise.all([
    sharedFrame.contentWindow.fetch(`${shared.base}book/data.bin`),
    sharedFrame.contentWindow.fetch(`${shared.base}book/other.bin`)
  ])
  const oneReader = one.body.getReader()
  await oneReader.read()
  await oneReader.cancel()
  const twoReader = two.body.getReader()
  let sharedBytes = 0
  for (;;) {
    const next = await twoReader.read()
    if (next.done) break
    for (let i = 0; i < next.value.length; i++) {
      p.check(next.value[i] === (sharedBytes + i) % 251, 'Another consumer changed shared bytes.')
    }
    sharedBytes += next.value.byteLength
  }
  await p.until(() => sharedSource.stats.leases === 0, 'Shared source occupancy remained.')
  p.check(
    sharedBytes === sharedSource.size && sharedSource.stats.released === 2,
    'Cancelling one use ended the other use.'
  )
  results.sharedOccupancy = { sharedBytes, ...sharedSource.stats }
  await p.close(shared.token)
  sharedFrame.remove()
  console.info('runtime-case:shared-occupancy')

  const slow = await p.mount('v1', { size: 32 * 1024 * 1024, delay: 2 })
  const slowFrame = await p.frameAt(`${slow.base}book/index.html`)
  const slowSource = p.mounts.get(slow.token).files.get('/book/data.bin')
  const slowResponse = await slowFrame.contentWindow.fetch(`${slow.base}book/data.bin`)
  const slowReader = slowResponse.body.getReader()
  await slowReader.read()
  const beforePause = slowSource.stats.bytes
  await p.wait(200)
  const afterPause = slowSource.stats.bytes
  await slowReader.cancel()
  await p.wait(200)
  const afterCancel = { ...slowSource.stats }
  await p.close(slow.token)
  results.nativeCancel = {
    beforePause,
    afterPause,
    afterCancel,
    afterOwnerClose: { ...slowSource.stats }
  }
  slowFrame.remove()
  console.info('runtime-case:native-cancel')

  const closing = await p.mount('v1', {
    size: 8 * 1024 * 1024,
    delay: 5000,
    settleAfterAbort: 80,
    firstChunkImmediate: true
  })
  const closingFrame = await p.frameAt(`${closing.base}book/index.html`)
  const closingSource = p.mounts.get(closing.token).files.get('/book/data.bin')
  const closingResponse = await closingFrame.contentWindow.fetch(`${closing.base}book/data.bin`)
  const closingReader = closingResponse.body.getReader()
  let deliveredBeforeClose = 0
  while (deliveredBeforeClose < byteBridge.CHUNK_BYTES) {
    const first = await closingReader.read()
    deliveredBeforeClose += first.value.byteLength
  }
  const pendingRead = closingReader.read().then(
    () => 'read',
    () => 'rejected'
  )
  await p.until(() => closingSource.stats.inflight === 1, 'The slow read did not start.')
  const started = performance.now()
  let settled = false
  const closed = p.close(closing.token).then(() => {
    settled = true
  })
  await p.wait(20)
  p.check(!settled, 'Close returned before its source had stopped.')
  await closed
  results.ownerClose = {
    elapsed: performance.now() - started,
    deliveredBeforeClose,
    readResult: await pendingRead,
    ...closingSource.stats
  }
  p.check(results.ownerClose.readResult === 'rejected', 'Closed content returned bytes.')
  closingFrame.remove()
  console.info('runtime-case:owner-close')

  const failed = await p.mount('v1', { size: 2 * 1024 * 1024, failAt: 2 * byteBridge.CHUNK_BYTES })
  const failedFrame = await p.frameAt(`${failed.base}book/index.html`)
  const failedResponse = await failedFrame.contentWindow.fetch(`${failed.base}book/data.bin`)
  let failedBytes = 0
  let failedRead = false
  try {
    const read = failedResponse.body.getReader()
    for (;;) {
      const next = await read.read()
      if (next.done) break
      failedBytes += next.value.byteLength
    }
  } catch {
    failedRead = true
  }
  const failedSource = p.mounts.get(failed.token).files.get('/book/data.bin')
  await p.until(() => failedSource.stats.leases === 0, 'A failed source remained held.')
  p.check(
    failedRead && failedBytes < failedSource.size,
    'A partial response was reported complete.'
  )
  results.sourceFailure = { failedRead, failedBytes, ...failedSource.stats }
  await p.close(failed.token)
  failedFrame.remove()
  console.info('runtime-case:source-failure')
  const disposal = await p.mount('v1', {
    size: 4 * 1024 * 1024,
    delay: 5000,
    firstChunkImmediate: true,
    settleAfterAbort: 20,
    failDispose: true
  })
  const disposalValue = p.mounts.get(disposal.token)
  disposalValue.files.set(
    '/book/second.bin',
    p.source({
      size: 4 * 1024 * 1024,
      delay: 5000,
      firstChunkImmediate: true,
      settleAfterAbort: 80
    })
  )
  disposalValue.files.set(
    '/book/third.bin',
    p.source({
      size: 4 * 1024 * 1024,
      delay: 5000,
      firstChunkImmediate: true,
      settleAfterAbort: 120
    })
  )
  const disposalFrame = await p.frameAt(`${disposal.base}book/index.html`)
  const names = ['/book/data.bin', '/book/second.bin', '/book/third.bin']
  const pendingDisposal = await Promise.all(
    names.map(async (name) => {
      const response = await disposalFrame.contentWindow.fetch(disposal.base + name.slice(1))
      const read = response.body.getReader()
      let delivered = 0
      while (delivered < byteBridge.CHUNK_BYTES) {
        const next = await read.read()
        delivered += next.value.byteLength
      }
      return {
        result: read.read().then(
          () => 'read',
          () => 'rejected'
        )
      }
    })
  )
  await p.until(
    () => names.every((name) => disposalValue.files.get(name).stats.inflight === 1),
    'Cleanup fixtures did not all start.'
  )
  const cleanupStart = performance.now()
  let cleanupFailure
  try {
    await p.close(disposal.token)
  } catch (error) {
    cleanupFailure = error.reason
  }
  const cleanupReads = await Promise.all(pendingDisposal.map((item) => item.result))
  const releasedSources = names.map((name) => ({ ...disposalValue.files.get(name).stats }))
  p.check(
    cleanupFailure === 'readFailed' &&
      cleanupReads.every((result) => result === 'rejected') &&
      releasedSources.every((item) => item.leases === 0 && item.inflight === 0),
    'One cleanup failure skipped other resource cleanup.'
  )
  p.check(
    performance.now() - cleanupStart >= 100,
    'Failed cleanup returned before another source settled.'
  )
  results.cleanupFailure = {
    failure: cleanupFailure,
    elapsed: performance.now() - cleanupStart,
    sources: releasedSources
  }
  disposalFrame.remove()
  console.info('runtime-case:cleanup-failure')
  const stress = []
  for (let i = 0; i < 8; i++) {
    const item = p.source({ size: 4 * 1024 * 1024, delay: 5000 })
    const controller = new AbortController()
    const channel = new MessageChannel()
    item.stats.leases++
    const transfer = byteBridge.serveBytes(
      channel.port1,
      item,
      controller.signal,
      p.budget,
      item.stats,
      async () => {
        item.stats.leases--
      }
    )
    channel.port2.onmessage = ({ data }) => {
      if (data.type === 'meta') channel.port2.postMessage({ type: 'pull' })
    }
    stress.push({ item, controller, channel, transfer })
  }
  await p.until(
    () => p.budget.stats.active === 4 && p.budget.stats.queued === 4,
    'Read admission did not bound concurrent work.'
  )
  const saturated = { ...p.budget.stats }
  stress.forEach(({ controller }) => controller.abort())
  await Promise.all(stress.map(({ transfer }) => transfer.ended))
  stress.forEach(({ channel }) => channel.port2.close())
  p.check(
    p.budget.stats.active === 0 && p.budget.stats.queued === 0,
    'Cancelled work retained permits.'
  )
  results.admission = {
    saturated,
    ended: stress.map(({ item }) => ({ ...item.stats })),
    after: { ...p.budget.stats }
  }
  const priority = byteBridge.createReadBudget(1)
  const signal = new AbortController().signal
  const held = await priority.acquire(signal)
  const order = []
  const background = priority.acquire(signal, 1).then((release) => {
    order.push('background')
    release()
  })
  const foreground = priority.acquire(signal, 0).then((release) => {
    order.push('current')
    release()
  })
  held()
  await Promise.all([foreground, background])
  p.check(
    order.join(',') === 'current,background',
    'Background reads passed a waiting current read.'
  )
  results.priority = order
  console.info('runtime-case:admission')
  results.identity = initial.identity
  results.worker = await p.ask(p.registrations.get('v1').active, { type: 'identity' })
  results.budget = { ...p.budget.stats }
  return results
}

globalThis.runStreamCases = runStreamCases

async function runDeploymentCases() {
  const p = runtimeProbe
  const results = {}
  const old = await p.mount('v1')
  const oldFrame = await p.frameAt(`${old.base}book/index.html`)
  const oldController = oldFrame.contentWindow.navigator.serviceWorker.controller.scriptURL
  const root = await navigator.serviceWorker.register('/pwa.js', { scope: '/' })
  const rootWorker = root.active || root.installing || root.waiting
  if (rootWorker.state !== 'activated') {
    await new Promise((resolve) =>
      rootWorker.addEventListener('statechange', () => {
        if (rootWorker.state === 'activated') resolve()
      })
    )
  }
  await p.until(
    () => navigator.serviceWorker.controller?.scriptURL.endsWith('/pwa.js'),
    'The fixture PWA did not control its page.'
  )
  const pwaReply = await (await fetch('/pwa-ping')).text()
  p.check(pwaReply === 'pwa-owner', 'The PWA lost its own resource path.')
  p.check(
    oldFrame.contentWindow.navigator.serviceWorker.controller.scriptURL === oldController,
    'The PWA replaced a narrower content controller.'
  )
  const current = await p.mount('v2')
  const currentFrame = await p.frameAt(`${current.base}book/index.html`)
  const currentController = currentFrame.contentWindow.navigator.serviceWorker.controller.scriptURL
  p.check(
    currentController.includes('/assets/v2/') && oldController.includes('/assets/v1/'),
    'Versions did not retain separate controllers.'
  )
  const identityOld = await p.ask(p.registrations.get('v1').active, { type: 'identity' })
  const identityCurrent = await p.ask(p.registrations.get('v2').active, { type: 'identity' })
  p.check(
    identityOld.version === 'v1' && identityCurrent.version === 'v2',
    'Version identities collided.'
  )
  results.coexistence = {
    hostController: navigator.serviceWorker.controller.scriptURL,
    oldController,
    currentController,
    pwaReply
  }
  await new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.type = 'module'
    script.src = '/other-owner.js'
    script.onload = resolve
    script.onerror = reject
    document.head.append(script)
  })
  const other = await otherProbe.mount('v2', { size: 1024 })
  const otherFrame = await p.frameAt(`${other.base}book/index.html`)
  const firstOther = await otherFrame.contentWindow.fetch(`${other.base}book/data.bin`)
  p.check(
    (await firstOther.arrayBuffer()).byteLength === 1024,
    'Independent library copies handled each other’s routes.'
  )
  await otherProbe.close(other.token)
  const expiredOther = await otherFrame.contentWindow.fetch(`${other.base}book/data.bin`)
  const mainStillReadable = await currentFrame.contentWindow.fetch(`${current.base}book/data.bin`)
  p.check(
    expiredOther.status === 410 &&
      (await mainStillReadable.arrayBuffer()).byteLength === 2 * 1024 * 1024,
    'Closing one library copy affected another copy.'
  )
  results.independentCopies = {
    distinctRoutingIds: other.token.split('.')[0] !== current.token.split('.')[0],
    expiredStatus: expiredOther.status,
    remainingOtherLeases: otherProbe.allSources.reduce((sum, item) => sum + item.stats.leases, 0),
    mainStillReadable: true
  }
  otherFrame.remove()
  console.info('runtime-case:pwa-and-versions')

  const conflict = await navigator.serviceWorker.register('/foreign.js', {
    scope: '/assets/conflict/'
  })
  const conflictWorker = conflict.active || conflict.installing || conflict.waiting
  if (conflictWorker.state !== 'activated') {
    await new Promise((resolve) =>
      conflictWorker.addEventListener('statechange', () => {
        if (conflictWorker.state === 'activated') resolve()
      })
    )
  }
  let rejected = null
  try {
    await p.prepare('conflict')
  } catch (error) {
    rejected = error.reason
  }
  p.check(rejected === 'assetUnavailable', 'A conflicting scope was silently replaced.')
  const stillForeign = (await navigator.serviceWorker.getRegistration('/assets/conflict/')).active
    .scriptURL
  p.check(stillForeign.endsWith('/foreign.js'), 'Scope conflict detection changed its owner.')
  results.conflict = { rejected, stillForeign }
  await conflict.unregister()
  console.info('runtime-case:scope-conflict')

  const blocked = await p.frameAt('/blocked.html')
  let blockedReason = null
  try {
    await blocked.contentWindow.runtimeProbe.prepare('blocked')
  } catch (error) {
    blockedReason = error.reason
  }
  p.check(
    blockedReason === 'assetUnavailable',
    'Worker restrictions did not produce an explicit asset failure.'
  )
  results.blockedWorker = { reason: blockedReason }
  blocked.remove()

  const setupController = new AbortController()
  const mountsBefore = p.mounts.size
  const sourcesBefore = p.allSources.length
  const cancelledSetup = p.mount('install-slow', {}, setupController.signal).then(
    () => 'opened',
    (error) => error.reason
  )
  await p.wait(20)
  setupController.abort()
  const setupResult = await cancelledSetup
  await p.prepare('install-slow')
  p.check(
    setupResult === 'cancelled' &&
      p.mounts.size === mountsBefore &&
      p.allSources.length === sourcesBefore,
    'Cancelled static setup published content ownership.'
  )
  results.cancelSetup = {
    result: setupResult,
    noContentPublished: true,
    staticRegistrationMayComplete: true
  }

  const patient = await p.mount('v2', { size: 1024, metadataDelay: 1250 })
  const patientFrame = await p.frameAt(`${patient.base}book/index.html`)
  const patientStart = performance.now()
  const patientResponse = await patientFrame.contentWindow.fetch(`${patient.base}book/data.bin`)
  const patientBytes = await patientResponse.arrayBuffer()
  p.check(
    patientResponse.ok && patientBytes.byteLength === 1024,
    'A live slow owner was treated as lost.'
  )
  results.liveSlowOwner = {
    elapsed: performance.now() - patientStart,
    bytes: patientBytes.byteLength
  }
  await p.close(patient.token)
  patientFrame.remove()

  const unopened = await p.mount('v2', { size: 1024, metadataDelay: 20, failOpen: true })
  const unopenedFrame = await p.frameAt(`${unopened.base}book/index.html`)
  const failedOpenResponse = await unopenedFrame.contentWindow.fetch(
    `${unopened.base}book/data.bin`
  )
  const unopenedSource = p.mounts.get(unopened.token).files.get('/book/data.bin')
  p.check(
    failedOpenResponse.status === 500 &&
      unopenedSource.stats.reads === 0 &&
      unopenedSource.stats.leases === 0,
    'An opening failure waited indefinitely or acquired bytes.'
  )
  results.failedOpening = { status: failedOpenResponse.status, ...unopenedSource.stats }
  await p.close(unopened.token)
  unopenedFrame.remove()

  const owningFrame = await p.frameAt('/host.html')
  const owned = await owningFrame.contentWindow.runtimeProbe.mount('v2', {
    size: 1024 * 1024,
    metadataDelay: 5000
  })
  const survivingFrame = await p.frameAt(`${owned.base}book/index.html`)
  const pendingOwned = survivingFrame.contentWindow.fetch(`${owned.base}book/data.bin`).then(
    (response) => response.status,
    () => 'rejected'
  )
  await p.until(
    () => owningFrame.contentWindow.runtimeProbe.mounts.get(owned.token).transfers.size === 1,
    'The delayed resource did not start in its owning document.'
  )
  const ownerLostAt = performance.now()
  owningFrame.remove()
  const orphanStatus = await pendingOwned
  p.check(
    orphanStatus === 410 || orphanStatus === 'rejected',
    'A departed owner supplied new content.'
  )
  results.ownerDisappeared = { orphanStatus, elapsed: performance.now() - ownerLostAt }
  survivingFrame.remove()
  console.info('runtime-case:owner-disappeared')

  const opening = await p.mount('v2', { size: 1024 * 1024, metadataDelay: 5000 })
  const openingFrame = await p.frameAt(`${opening.base}book/index.html`)
  const openingValue = p.mounts.get(opening.token)
  const pendingOpen = openingFrame.contentWindow.fetch(`${opening.base}book/data.bin`).then(
    (response) => response.status,
    () => 'rejected'
  )
  await p.until(() => openingValue.transfers.size === 1, 'A resource opening was not tracked.')
  await p.close(opening.token)
  const cancelledOpen = await pendingOpen
  p.check(
    cancelledOpen === 410 && openingValue.files.get('/book/data.bin').stats.reads === 0,
    'A cancelled opening continued to read bytes.'
  )
  results.cancelOpening = { status: cancelledOpen, remainingTasks: openingValue.transfers.size }
  openingFrame.remove()

  await p.close(old.token)
  oldFrame.remove()
  const oldUnregistered = await p.registrations.get('v1').unregister()
  const reloadedCurrent = await p.frameAt(`${current.base}book/index.html`)
  p.check(
    reloadedCurrent.contentDocument.getElementById('ready')?.textContent === 'Native content',
    'Retiring an idle old scope broke the active version.'
  )
  const afterCleanupPwa = await (await fetch('/pwa-ping')).text()
  p.check(afterCleanupPwa === 'pwa-owner', 'Retiring an old scope changed the PWA.')
  results.oldVersionCleanup = {
    oldUnregistered,
    currentStillReadable: true,
    pwaStillActive: afterCleanupPwa === 'pwa-owner'
  }
  reloadedCurrent.remove()
  currentFrame.remove()
  await p.close(current.token)
  console.info('runtime-case:old-version-cleanup')
  return results
}

async function runStorageCases() {
  const p = runtimeProbe
  const results = { persistentPermissionRequested: false }
  if (typeof navigator.storage?.getDirectory === 'function') {
    const root = await navigator.storage.getDirectory()
    const name = `kana-resource-probe-${crypto.randomUUID()}`
    const directory = await root.getDirectoryHandle(name, { create: true })
    try {
      const file = await directory.getFileHandle('snapshot.bin', { create: true })
      const writer = await file.createWritable()
      await writer.write(p.pattern(0, 1024))
      await writer.write({ type: 'write', position: 1024, data: p.pattern(1024, 1024) })
      await writer.close()
      const snapshot = await file.getFile()
      const bytes = new Uint8Array(await snapshot.slice(700, 1600).arrayBuffer())
      p.check(
        bytes.length === 900 && bytes.every((value, index) => value === (700 + index) % 251),
        'Temporary range reads changed bytes.'
      )
      results.opfs = { available: true, size: snapshot.size, rangeBytes: bytes.length }
    } finally {
      await root.removeEntry(name, { recursive: true })
    }
    let remains = false
    for await (const entry of root.keys()) if (entry === name) remains = true
    p.check(!remains, 'The temporary probe directory remained after release.')
    results.opfs.cleaned = true
  } else results.opfs = { available: false }

  function input(size) {
    const stats = { produced: 0, cancelled: 0 }
    return {
      stats,
      stream: new ReadableStream(
        {
          pull(controller) {
            const length = Math.min(byteBridge.CHUNK_BYTES, size - stats.produced)
            controller.enqueue(p.pattern(stats.produced, length))
            stats.produced += length
            if (stats.produced === size) controller.close()
          },
          cancel() {
            stats.cancelled++
          }
        },
        { highWaterMark: 0 }
      )
    }
  }
  const small = input(96 * 1024)
  const memory = await snapshotStream(small.stream, null, 128 * 1024)
  results.boundedMemory = { size: memory.size, peakRetained: memory.peakRetained, ...small.stats }
  await memory.dispose()
  const oversized = input(1024 * 1024)
  let exceeded
  try {
    await snapshotStream(oversized.stream, null, 128 * 1024)
  } catch (error) {
    exceeded = error.reason
  }
  p.check(
    exceeded === 'resourceLimit' &&
      oversized.stats.produced === 3 * byteBridge.CHUNK_BYTES &&
      oversized.stats.cancelled === 1,
    'A memory-limited snapshot kept consuming its input.'
  )
  results.memoryLimit = { failure: exceeded, ...oversized.stats }
  const writing = input(1024 * 1024)
  const storageStats = { writes: 0, retained: 0, disposed: 0 }
  const quotaStorage = {
    async create() {
      return {
        async write(offset, bytes) {
          storageStats.writes++
          if (storageStats.writes === 2) {
            throw Object.assign(new Error('Controlled temporary write quota failure.'), {
              reason: 'resourceLimit'
            })
          }
          storageStats.retained += bytes.byteLength
        },
        async dispose() {
          storageStats.retained = 0
          storageStats.disposed++
        }
      }
    }
  }
  let quota
  try {
    await snapshotStream(writing.stream, quotaStorage, 128 * 1024)
  } catch (error) {
    quota = error.reason
  }
  p.check(
    quota === 'resourceLimit' &&
      storageStats.disposed === 1 &&
      storageStats.retained === 0 &&
      writing.stats.cancelled === 1 &&
      writing.stats.produced === 2 * byteBridge.CHUNK_BYTES,
    'A temporary-write failure did not cancel and dispose its snapshot.'
  )
  results.quotaBoundary = {
    injectedFailure: true,
    failure: quota,
    ...storageStats,
    ...writing.stats
  }
  const denied = input(1024 * 1024)
  let denial
  try {
    await snapshotStream(
      denied.stream,
      {
        async create() {
          throw Object.assign(new Error('Controlled temporary storage denial.'), {
            reason: 'resourceLimit'
          })
        }
      },
      128 * 1024
    )
  } catch (error) {
    denial = error.reason
  }
  p.check(
    denial === 'resourceLimit' && denied.stats.produced === 0 && denied.stats.cancelled === 1,
    'Unavailable storage consumed or retained the input.'
  )
  results.storageDenied = { injectedFailure: true, failure: denial, ...denied.stats }
  console.info('runtime-case:temporary-storage')
  return results
}

globalThis.runDeploymentCases = runDeploymentCases
globalThis.runStorageCases = runStorageCases

async function beginWorkerInterruption() {
  const p = runtimeProbe
  const target = await p.mount('v2', {
    size: 8 * 1024 * 1024,
    delay: 5000,
    settleAfterAbort: 80,
    firstChunkImmediate: true
  })
  const frame = await p.frameAt(`${target.base}book/index.html`)
  const item = p.mounts.get(target.token).files.get('/book/data.bin')
  const response = await frame.contentWindow.fetch(`${target.base}book/data.bin`)
  const reader = response.body.getReader()
  let delivered = 0
  while (delivered < byteBridge.CHUNK_BYTES) {
    const first = await reader.read()
    delivered += first.value.byteLength
  }
  const result = reader.read().then(
    () => 'read',
    () => 'rejected'
  )
  await p.until(() => item.stats.inflight === 1, 'The interrupted read did not start.')
  const identity = await p.ask(p.registrations.get('v2').active, { type: 'identity' })
  p.interrupted = { target, frame, item, result, identity }
  return identity
}

async function finishWorkerInterruption() {
  const p = runtimeProbe
  const { target, frame, item, result, identity } = p.interrupted
  await p.until(
    () => item.stats.leases === 0,
    'A terminated worker retained source ownership.',
    10000
  )
  const after = await p.ask(p.registrations.get('v2').active, { type: 'identity' })
  p.check(after.bootId !== identity.bootId, 'The service worker did not restart.')
  const readResult = await result
  p.check(readResult === 'rejected', 'The interrupted native response succeeded.')
  const releasedBeforeClose = item.stats.leases === 0
  const recovered = await p.frameAt(`${target.base}book/index.html?after-restart=1`)
  const readableAfterRestart =
    recovered.contentDocument.getElementById('ready')?.textContent === 'Native content'
  p.check(readableAfterRestart, 'The same live owner was not readable after worker restart.')
  recovered.remove()
  await p.close(target.token)
  frame.remove()
  delete p.interrupted
  return {
    bootChanged: true,
    readResult,
    releasedBeforeClose,
    readableAfterRestart,
    stats: { ...item.stats }
  }
}

globalThis.beginWorkerInterruption = beginWorkerInterruption
globalThis.finishWorkerInterruption = finishWorkerInterruption
