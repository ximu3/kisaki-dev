const assert = require('node:assert/strict')

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const deferred = () => Promise.withResolvers()

function sample(frame) {
  const bytes = frame.pixels()
  const offset = (24 * 64 + 32) * 4
  return [bytes[offset + 2], bytes[offset + 1], bytes[offset], bytes[offset + 3]]
}

function assertColor(pixel, color) {
  const channel = color === 'red' ? 0 : 2
  assert(pixel[channel] > 220, `Unexpected ${color} sample: ${pixel}`)
  assert(pixel[1] < 35 && pixel[2 - channel] < 35 && pixel[3] === 255)
}

async function runScenario({ addon, dll, red, blue, missing, renderFirst, transport }) {
  const { HandoffProbe } = require(addon)
  const probe = new HandoffProbe()
  const ready = deferred()
  const barriers = new Map()
  const waiters = new Set()
  const owned = new Set()
  const events = []
  const deliveries = []
  const stages = []
  const lateNodeOracle = []
  const failures = []
  let current
  let nextRequest = 100
  let nextToken = 0
  let activeToken = 0
  let inFlight
  let pending
  let armNodeDelay = false
  let nodeDelayQueued = false
  let nodeDelayFinished = false
  let staleNodeDrops = 0
  let discardedRedraws = 0
  let naiveRelabelMismatches = 0
  let accepting = true
  let adapterLuid
  const deferredJobs = new Set()

  function release(frame) {
    if (owned.delete(frame)) frame.release()
  }
  function changed() {
    for (const update of [...waiters]) update()
  }
  function fail(error) {
    failures.push(error)
    changed()
  }
  function waitFor(predicate, label, milliseconds = 6000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error(`Timed out: ${label}`)), milliseconds)
      const check = () => {
        if (failures.length) finish(failures[0])
        else if (predicate()) finish()
      }
      function finish(error) {
        clearTimeout(timer)
        waiters.delete(check)
        error ? reject(error) : resolve()
      }
      waiters.add(check)
      check()
    })
  }
  function barrier(token) {
    assert(!barriers.has(token))
    const result = deferred()
    barriers.set(token, result)
    probe.enqueue('subscription', token)
    return result.promise
  }
  function command(action, text) {
    const request = ++nextRequest
    probe.enqueue(action, request, text)
    return request
  }
  function offer(notice, stage) {
    if (inFlight) {
      if (pending) release(pending.notice.frame)
      pending = { notice, stage }
      return
    }
    inFlight = transport
      .deliver(notice.frame, stage.token, stage.color, release)
      .then((result) => {
        deliveries.push({ token: stage.token, order: notice.order, ...result })
        if (result.accepted) {
          assertColor(result.sample, stage.color)
          stage.consumed++
        }
      })
      .catch(fail)
      .finally(() => {
        inFlight = undefined
        const next = pending
        pending = undefined
        if (next) {
          if (accepting && next.stage === current && next.stage.ready)
            offer(next.notice, next.stage)
          else release(next.notice.frame)
        }
        changed()
      })
  }
  function tryReady() {
    const stage = current
    if (
      !stage ||
      stage.ready ||
      stage.activating ||
      !stage.entry ||
      !stage.loaded ||
      !stage.restarted ||
      !stage.candidate ||
      stage.failure
    )
      return
    stage.activating = true
    transport
      .begin(stage.token)
      .then(() => {
        if (stage !== current) throw new Error('Stage changed during activation.')
        stage.ready = true
        const candidate = stage.candidate
        stage.candidate = undefined
        offer(candidate, stage)
        changed()
      })
      .catch(fail)
  }
  function processFrame(notice, delayed = false) {
    const stage = current
    if (!accepting || !stage || notice.token !== activeToken || notice.token !== stage.token) {
      staleNodeDrops++
      // Oracle only: the admission decision above never uses source pixels.
      if (delayed && stage?.ready) {
        const observed = sample(notice.frame)
        lateNodeOracle.push({
          token: notice.token,
          currentToken: stage.token,
          currentColor: stage.color,
          admitted: false,
          sample: observed
        })
        if (stage.color === 'blue' && observed[0] > 220 && observed[2] < 35)
          naiveRelabelMismatches++
      }
      release(notice.frame)
    } else if (!stage.ready && (!(notice.flags & 1) || notice.flags & 6)) {
      discardedRedraws++
      release(notice.frame)
    } else if (!stage.ready) {
      if (stage.candidate) release(stage.candidate.frame)
      stage.candidate = notice
      tryReady()
    } else offer(notice, stage)
    if (delayed) nodeDelayFinished = true
    changed()
  }
  function onFrame(notice) {
    try {
      if (notice.kind === 3) {
        const result = barriers.get(notice.request)
        assert(result, 'Unknown frame-channel barrier.')
        barriers.delete(notice.request)
        result.resolve()
        return
      }
      assert.equal(notice.kind, 1)
      owned.add(notice.frame)
      adapterLuid ??= notice.frame.adapterLuid()
      if (armNodeDelay && notice.token === 1 && !(notice.flags & 6)) {
        armNodeDelay = false
        nodeDelayQueued = true
        const job = waitFor(
          () => current?.ready && current.token !== notice.token,
          'new stage before late Node callback'
        )
          .then(() => processFrame(notice, true))
          .catch(fail)
          .finally(() => deferredJobs.delete(job))
        deferredJobs.add(job)
        changed()
      } else processFrame(notice)
    } catch (error) {
      fail(error)
    }
  }
  function onEvent(notice) {
    try {
      events.push({ ...notice, frame: undefined })
      if (notice.kind === 4) ready.resolve()
      const stage = current
      if (!stage || notice.kind !== 2) {
        changed()
        return
      }
      if (notice.event === 6) stage.entry = notice.entry
      if (notice.entry === stage.entry) {
        if (notice.event === 8) stage.loaded = true
        if (notice.event === 21) stage.restarted = true
        if (notice.event === 7 && notice.error < 0) stage.failure = notice.error
      }
      tryReady()
      changed()
    } catch (error) {
      fail(error)
    }
  }
  function onHook(notice) {
    ;(async () => {
      assert.equal(notice.kind, 6)
      const stage = current
      assert(stage && !stage.hook)
      stage.hook = notice.request
      activeToken = 0
      if (pending) {
        release(pending.notice.frame)
        pending = undefined
      }
      await barrier(0)
      // Callback dispatches and downstream asynchronous jobs have separate lifetimes.
      await sleep(renderFirst ? 23 : 7)
      activeToken = stage.token
      await barrier(stage.token)
      probe.enqueue('continue', notice.request)
    })().catch(fail)
  }
  transport.notify = changed
  const running = probe.run(dll, renderFirst, onEvent, onFrame, onHook)
  running.catch(fail)
  async function load(path, color, expectedFailure = false) {
    if (current?.candidate) release(current.candidate.frame)
    const stage = { token: ++nextToken, color, consumed: 0, ready: false }
    current = stage
    stages.push(stage)
    stage.request = command('load', path)
    await waitFor(() => stage.failure || (stage.ready && stage.consumed > 0), 'load stage')
    assert.equal(Boolean(stage.failure), expectedFailure)
    await waitFor(
      () => events.some((event) => event.event === 5 && event.request === stage.request),
      'load reply'
    )
    stage.commandError = events.find(
      (event) => event.event === 5 && event.request === stage.request
    ).error
    return stage
  }
  try {
    await ready.promise
    await load(red, 'red')
    armNodeDelay = true
    command('pause', 'no')
    await waitFor(() => nodeDelayQueued, 'late Node frame queued')
    transport.delayNext()
    await waitFor(() => transport.delayedEntered, 'late receiver frame entered')
    await load(blue, 'blue')
    await waitFor(() => nodeDelayFinished, 'late Node callback rejected')
    assert.equal(naiveRelabelMismatches, 1)
    assert(
      deliveries.some((item) => item.delayed && !item.accepted),
      'Late consumer did not reject the old token.'
    )
    const pause = command('pause', 'yes')
    await waitFor(
      () => events.some((event) => event.event === 5 && event.request === pause),
      'pause reply'
    )
    const beforeSeek = events.at(-1).order
    const seek = command('seek', '0.5')
    await waitFor(
      () =>
        events.some((event) => event.event === 5 && event.request === seek) &&
        events.some((event) => event.event === 21 && event.order > beforeSeek),
      'seek restart'
    )
    const positionRequest = command('position')
    await waitFor(
      () => events.some((event) => event.event === 3 && event.request === positionRequest),
      'position reply'
    )
    const position = events.find(
      (event) => event.event === 3 && event.request === positionRequest
    ).value
    assert(Math.abs(position - 0.5) < 0.02)
    await load(red, 'red')
    const missingStage = await load(missing, 'missing', true)
    assert.equal(missingStage.commandError, 0)
    await load(blue, 'blue')
    accepting = false
    activeToken = 0
    await barrier(0)
    if (pending) {
      release(pending.notice.frame)
      pending = undefined
    }
    if (current.candidate) {
      release(current.candidate.frame)
      current.candidate = undefined
    }
    await waitFor(() => !inFlight, 'delivery drained')
    await Promise.all(deferredJobs)
    probe.enqueue('stop', 0)
    const closeStats = await running
    assert(
      closeStats.nativeClosed && closeStats.live >= 1,
      'Held frame did not outlive native core.'
    )
    const held = await transport.closeHeld(release)
    assertColor(held.sample, 'red')
    await waitFor(() => owned.size === 0 && probe.stats().live === 0, 'all frame leases released')
    const stats = probe.stats()
    assert.equal(stats.created, stats.released)
    assert(stats.maxLive <= 4 && stats.hookCount === 5 && stats.created >= 8)
    assert(
      events.some((event) => event.kind === 5),
      'Independent observation client was not exercised.'
    )
    if (failures.length) throw failures[0]
    return {
      renderFirst,
      adapterLuid,
      stats,
      closeStats,
      position,
      stages: stages.map(
        ({ token, color, entry, loaded, restarted, ready, consumed, failure, commandError }) => ({
          token,
          color,
          entry,
          loaded,
          restarted,
          ready,
          consumed,
          failure,
          commandError
        })
      ),
      events,
      deliveries,
      lateNodeOracle,
      staleNodeDrops,
      discardedRedraws,
      naiveRelabelMismatches,
      heldFrameAfterCoreClose: held,
      realNodeCallbacks: true,
      independentNativeHookClient: true,
      independentNativeObservationClient: true,
      distinctThreadsafeCallbackChannels: 3,
      independentNativeRenderThread: true,
      pollingMilliseconds: { render: renderFirst ? 1 : 3, control: renderFirst ? 3 : 1 },
      framePixelsUsedForAdmission: false,
      sourceFileIdentityAttachedToNativeFrame: false,
      reusedBackingTexturePoolVerified: false,
      arbitraryScriptSwitchingVerified: false
    }
  } finally {
    accepting = false
    try {
      probe.enqueue('stop', 0)
    } catch {}
    await running.catch(() => {})
    await Promise.allSettled(deferredJobs)
    await transport.dispose(release)
    for (const frame of [...owned]) release(frame)
  }
}

function nodeTransport() {
  let epoch = 0
  let delay = false
  let first
  let delayedRelease
  return {
    delayedEntered: false,
    async begin(token) {
      epoch = token
      delayedRelease?.resolve()
    },
    delayNext() {
      delay = true
    },
    async deliver(frame, token, color, release) {
      const delayed = delay
      delay = false
      if (delayed) {
        delayedRelease = deferred()
        this.delayedEntered = true
        this.notify?.()
        await delayedRelease.promise
        delayedRelease = undefined
      }
      const accepted = token === epoch
      const pixel = sample(frame)
      if (!first && accepted) first = frame
      else release(frame)
      return { accepted, delayed, sample: pixel }
    },
    async closeHeld(release) {
      const pixel = sample(first)
      release(first)
      first = undefined
      return { sample: pixel, afterCoreClose: true }
    },
    async dispose(release) {
      delayedRelease?.resolve()
      if (first) {
        release(first)
        first = undefined
      }
    }
  }
}

module.exports = { runScenario, nodeTransport, assertColor }
