import assert from 'node:assert/strict'
import { AsyncLocalStorage } from 'node:async_hooks'
import { once } from 'node:events'
import { createRequire } from 'node:module'
import { setTimeout as delay } from 'node:timers/promises'
import { Worker } from 'node:worker_threads'
import { ProbePlayer } from './provider.mjs'

const [addonPath, dllPath] = process.argv.slice(2)
const { liveCores } = createRequire(import.meta.url)(addonPath)
const unhandled = []
process.on('unhandledRejection', (reason) => unhandled.push(reason))
const watchdog = setTimeout(() => {
  process.stderr.write('Probe exceeded its execution deadline.\n')
  process.exit(2)
}, 25000)

async function until(predicate, label) {
  const deadline = performance.now() + 4000
  while (!predicate()) {
    assert(performance.now() < deadline, `Probe condition did not complete: ${label}`)
    await delay(5)
  }
}

function wave() {
  const bytes = Buffer.alloc(16044)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(8000, 24)
  bytes.writeUInt32LE(16000, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(16000, 40)
  return bytes
}

function source(overrides = {}) {
  let position = 0
  const bytes = wave()
  return {
    read(maxBytes) {
      if (position >= bytes.length) return null
      const value = bytes.subarray(position, position + maxBytes)
      position += value.length
      return value
    },
    seek(offset) {
      position = Number(offset)
    },
    getSize() {
      return BigInt(bytes.length)
    },
    close() {},
    ...overrides
  }
}

function player(provider) {
  return new ProbePlayer(addonPath, dllPath, provider)
}

const cases = []
const context = new AsyncLocalStorage()
const independent = player({
  open() {
    throw new Error('Unused probe provider.')
  },
  onError() {}
})

try {
  const errors = []
  const observations = []
  let closes = 0
  let current
  let request
  const bytes = source()
  const read = bytes.read
  bytes.read = async function (capacity) {
    await delay(1)
    assert.equal(this, bytes)
    observations.push(context.getStore())
    assert.throws(() => current.pause(), { code: 'reentrantStreamCall' })
    assert.equal(independent.pause(), true)
    this.read = () => {
      throw new Error('Uncaptured probe method.')
    }
    return read.call(this, capacity)
  }
  bytes.close = async function () {
    await delay(1)
    assert.equal(this, bytes)
    assert.throws(() => current.close(), { code: 'reentrantStreamCall' })
    observations.push(context.getStore())
    closes++
  }
  const provider = {
    async open(value) {
      await delay(1)
      assert.equal(this, provider)
      observations.push(context.getStore())
      request = value
      return bytes
    },
    onError(failure) {
      errors.push(failure)
    }
  }
  current = context.run('registration', () => player(provider))
  provider.open = () => {
    throw new Error('Uncaptured probe provider.')
  }
  current.load()
  await until(() => current.events.includes(8), 'native file-loaded event')
  assert.equal(request.signal.aborted, false)
  await context.run('close-caller', () => current.close())
  assert.equal(closes, 1)
  assert.equal(errors.length, 0)
  assert(observations.length >= 3 && observations.every((value) => value === 'registration'))
  cases.push({
    name: 'load-context-reentry',
    observations: observations.length,
    ...current.native.statistics()
  })

  const readGate = Promise.withResolvers()
  const closeGate = Promise.withResolvers()
  let readStarted = false
  let closeStarted = false
  closes = 0
  request = null
  const canceledErrors = []
  const slowRead = player({
    open(value) {
      request = value
      return source({
        async read() {
          readStarted = true
          await readGate.promise
          return wave()
        },
        async close() {
          closeStarted = true
          await closeGate.promise
          closes++
        }
      })
    },
    onError(failure) {
      canceledErrors.push(failure)
    }
  })
  slowRead.load()
  await until(() => readStarted, 'pending native read')
  slowRead.stop()
  await until(() => request.signal.aborted, 'upstream cancellation')
  await until(() => slowRead.native.statistics().nativeCloses === 1, 'native stream close')
  assert.equal(closeStarted, false)
  let closed = false
  const closingRead = slowRead.close().then(() => {
    closed = true
  })
  await slowRead.nativeDone.promise
  assert.equal(closed, false)
  readGate.resolve()
  await until(() => closeStarted, 'cleanup after late read')
  assert.equal(closed, false)
  closeGate.resolve()
  await closingRead
  assert.equal(closes, 1)
  assert.equal(canceledErrors.length, 0)
  assert(slowRead.native.statistics().lateReplies >= 1)
  cases.push({ name: 'stop-read-and-join-cleanup', ...slowRead.native.statistics() })

  for (const reject of [false, true]) {
    const opening = Promise.withResolvers()
    const cleanup = Promise.withResolvers()
    let entered = false
    let cleanupEntered = false
    let request
    let closes = 0
    const errors = []
    const late = player({
      async open(value) {
        request = value
        entered = true
        await opening.promise
        return source({
          async close() {
            cleanupEntered = true
            await cleanup.promise
            closes++
          }
        })
      },
      onError(failure) {
        errors.push(failure)
      }
    })
    late.load()
    await until(() => entered, 'pending open')
    let settled = false
    const closing = late.close().then(() => {
      settled = true
    })
    await late.nativeDone.promise
    assert(request.signal.aborted)
    assert.equal(settled, false)
    assert.equal(late.native.statistics().nativeCloses, 0)
    if (reject) {
      opening.reject(Symbol('canceled open'))
    } else {
      opening.resolve()
      await until(() => cleanupEntered, 'late source cleanup')
      assert.equal(settled, false)
      cleanup.resolve()
    }
    await closing
    assert.equal(closes, reject ? 0 : 1)
    assert.equal(errors.length, 0)
    cases.push({
      name: reject ? 'canceled-open-rejection' : 'late-open-resource',
      ...late.native.statistics()
    })
  }

  const readReason = { kind: 'controlled-read-failure' }
  const readFailures = []
  let errorPlayer
  errorPlayer = player({
    open() {
      return source({
        read() {
          throw readReason
        }
      })
    },
    onError(failure) {
      readFailures.push(failure)
      errorPlayer.stop()
    }
  })
  errorPlayer.load()
  await until(() => readFailures.length > 0, 'passive error receiver')
  assert(
    readFailures.every((failure) => failure.reason === readReason && failure.operation === 'read')
  )
  await errorPlayer.close()
  cases.push({
    name: 'original-reason-and-passive-receiver',
    failures: readFailures.length,
    ...errorPlayer.native.statistics()
  })

  const callbackReason = Symbol('receiver failure')
  let receivedException
  let receiverCalls = 0
  process.once('uncaughtException', (reason) => {
    receivedException = reason
  })
  const callbackFailure = player({
    open() {
      return source({
        read() {
          return new Uint8Array()
        }
      })
    },
    onError(failure) {
      assert.equal(failure.reason.code, 'invalidStreamResult')
      receiverCalls++
      callbackFailure.stop()
      throw callbackReason
    }
  })
  callbackFailure.load()
  await until(() => receivedException !== undefined, 'uncaught receiver exception')
  assert.equal(receivedException, callbackReason)
  await callbackFailure.close()
  assert.equal(receiverCalls, 1)
  cases.push({
    name: 'invalid-bytes-and-uncaught-receiver',
    receiverCalls,
    ...callbackFailure.native.statistics()
  })

  const resources = []
  const cleanupErrors = []
  const aggregate = player({
    open() {
      const record = {
        gate: Promise.withResolvers(),
        entered: false,
        calls: 0,
        reason: Symbol('cleanup')
      }
      resources.push(record)
      return source({
        async close() {
          record.calls++
          record.entered = true
          await record.gate.promise
        }
      })
    },
    onError(failure) {
      cleanupErrors.push(failure)
    }
  })
  aggregate.load('probe://first.wav')
  await until(
    () => aggregate.events.filter((event) => event === 8).length === 1,
    'first loaded resource'
  )
  aggregate.load('probe://second.wav')
  await until(
    () => aggregate.events.filter((event) => event === 8).length === 2,
    'second loaded resource'
  )
  assert.equal(resources.length, 2)
  assert(resources[0].entered)
  const closingAggregate = aggregate.close()
  const rejectedAggregate = assert.rejects(closingAggregate, (error) => {
    assert(error instanceof AggregateError)
    assert.deepEqual(new Set(error.errors), new Set(resources.map((resource) => resource.reason)))
    assert.equal(cleanupErrors.length, 2)
    return true
  })
  await until(() => resources.every((resource) => resource.entered), 'all cleanup work')
  for (const resource of resources) resource.gate.reject(resource.reason)
  await rejectedAggregate
  assert(resources.every((resource) => resource.calls === 1))
  assert(cleanupErrors.every((failure) => failure.operation === 'close'))
  cases.push({
    name: 'aggregate-cleanup-failures',
    failures: cleanupErrors.length,
    ...aggregate.native.statistics()
  })

  for (const operation of ['open', 'read']) {
    const cleanupMarker = new SharedArrayBuffer(4)
    const worker = new Worker(new URL('./worker.mjs', import.meta.url), {
      workerData: { addonPath, dllPath, operation, cleanupMarker }
    })
    const [message] = await once(worker, 'message')
    assert.equal(message, operation)
    assert.equal(liveCores(), 2)
    await worker.terminate()
    assert.equal(liveCores(), 1)
    assert.equal(independent.pause(), true)
    assert.equal(Atomics.load(new Int32Array(cleanupMarker), 0), 0)
    cases.push({
      name: `worker-terminate-${operation}`,
      nativeDestroyed: true,
      survivingCoreUsable: true,
      javascriptCleanupRan: false
    })
  }

  const natural = new Worker(new URL('./worker.mjs', import.meta.url), {
    workerData: {
      addonPath,
      dllPath,
      operation: 'natural-open',
      cleanupMarker: new SharedArrayBuffer(4)
    }
  })
  const naturalExit = once(natural, 'exit')
  const [naturalMessage] = await once(natural, 'message')
  assert.equal(naturalMessage, 'natural-open')
  const [naturalCode] = await naturalExit
  assert.equal(naturalCode, 0)
  assert.equal(liveCores(), 1)
  assert.equal(independent.pause(), true)
  cases.push({
    name: 'worker-natural-exit-pending-open',
    exitCode: naturalCode,
    nativeDestroyed: true,
    survivingCoreUsable: true
  })
  await independent.close()
  await delay(20)
  assert.equal(liveCores(), 0)
  assert.deepEqual(unhandled, [])
  process.stdout.write(
    `${JSON.stringify({ node: process.version, nodeApi: process.versions.napi, cases, liveCores: liveCores(), unhandledRejections: unhandled.length })}\n`
  )
} finally {
  clearTimeout(watchdog)
}
