import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { MessageChannel } from 'node:worker_threads'
import { createBirpc } from 'birpc'

const { port1, port2 } = new MessageChannel()
const checks = []
let a, b
let completedAfterClose = false
let releasePending
let resolveEvent
const event = new Promise((resolve) => {
  resolveEvent = resolve
})
const options = (port) => ({
  post: (value) => port.postMessage(value),
  on: (fn) => port.on('message', fn),
  off: (fn) => port.off('message', fn),
  timeout: -1,
  proxify: false
})
const functionsA = Object.assign(Object.create(null), {
  increment: (value) => value + 1,
  event: (value) => resolveEvent(value)
})
const functionsB = Object.assign(Object.create(null), {
  nested: async (value) => b.$call('increment', value),
  failWithValue: () => {
    throw { code: 'WriteFailed', message: 'Failed to commit.', partialResult: { saved: ['a'] } }
  },
  failWithError: () => {
    const error = new Error('Failed to commit.')
    error.code = 'WriteFailed'
    error.partialResult = { saved: ['a'] }
    throw error
  },
  wait: async () => {
    await new Promise((resolve) => {
      releasePending = resolve
    })
    completedAfterClose = true
    return 1
  }
})
a = createBirpc(functionsA, options(port1))
b = createBirpc(functionsB, options(port2))
const record = (name, extra = {}) => checks.push({ name, passed: true, ...extra })
try {
  assert.equal(await a.$call('nested', 40), 41)
  record('Nested bidirectional calls complete without serializing the message pump')
  assert.deepEqual(await Promise.all([a.$call('nested', 1), b.$call('increment', 2)]), [2, 3])
  record('Independent simultaneous directions preserve their own call correlation')
  await b.$callEvent('event', 'observed')
  assert.equal(await event, 'observed')
  record('Explicit one-way event is delivered')
  const plain = await a.$call('failWithValue').catch((error) => error)
  assert.deepEqual(plain, {
    code: 'WriteFailed',
    message: 'Failed to commit.',
    partialResult: { saved: ['a'] }
  })
  record('Plain safe failure values survive the structured-clone transport')
  const native = await a.$call('failWithError').catch((error) => error)
  assert.equal(native.code, undefined)
  assert.equal(native.partialResult, undefined)
  record(
    'Native Error loses custom fields in MessageChannel; an explicit failure codec is required'
  )
  const pending = a.$call('wait').then(
    () => ({ success: true }),
    (error) => ({ error })
  )
  while (!releasePending) await new Promise((resolve) => setImmediate(resolve))
  const closed = new Error('Connection closed.')
  closed.code = 'ConnectionClosed'
  a.$close(closed)
  assert.equal((await pending).error.code, 'ConnectionClosed')
  releasePending()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(completedAfterClose, true)
  record('Closing the caller rejects waiting while already-started remote work can still finish')
  b.$close()
  assert.equal(port1.listenerCount('message'), 0)
  assert.equal(port2.listenerCount('message'), 0)
  record('Explicit off callbacks release listeners on close')
  fs.writeFileSync(
    path.join(import.meta.dirname, '../rpc-results.json'),
    JSON.stringify(
      {
        package: 'birpc',
        version: '4.2.0',
        node: process.version,
        checks,
        passed: true,
        notImplementedByThisProbe: [
          'per-call cancellation',
          'handshake',
          'instance ownership',
          'input authorization',
          'frame schema validation'
        ]
      },
      null,
      2
    )
  )
} finally {
  if (!a.$closed) a.$close()
  if (!b.$closed) b.$close()
  port1.close()
  port2.close()
}
