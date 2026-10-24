/** Inspect Node scheduling and EventEmitter behavior, not a native subscription dispatcher. */
import assert from 'node:assert/strict'
import { AsyncLocalStorage, AsyncResource } from 'node:async_hooks'
import { EventEmitter } from 'node:events'
import { writeFileSync } from 'node:fs'
import { setImmediate as laterTurn } from 'node:timers/promises'

const inlineOrder = []
const inlineCreated = new Promise((resolve) => {
  resolve()
  inlineOrder.push('notification')
})
await inlineCreated
inlineOrder.push('await-resumed')
assert.deepEqual(inlineOrder, ['notification', 'await-resumed'])

const microtaskOrder = []
const microtaskCreated = Promise.resolve()
queueMicrotask(() => microtaskOrder.push('notification'))
await microtaskCreated
microtaskOrder.push('await-resumed')
assert.deepEqual(microtaskOrder, ['notification', 'await-resumed'])

const turnOrder = []
const turnCreated = Promise.resolve()
setImmediate(() => turnOrder.push('notification'))
await turnCreated
turnOrder.push('await-resumed')
await laterTurn()
assert.deepEqual(turnOrder, ['await-resumed', 'notification'])

let release
const gate = new Promise((resolve) => {
  release = resolve
})
const callbackOrder = []
const emitter = new EventEmitter()
emitter.on('data', async () => {
  callbackOrder.push('entered')
  await gate
  callbackOrder.push('finished')
})
emitter.emit('data')
callbackOrder.push('emit-returned')
assert.deepEqual(callbackOrder, ['entered', 'emit-returned'])
release()
await laterTurn()
assert.deepEqual(callbackOrder, ['entered', 'emit-returned', 'finished'])

const original = new Error('Scheduling fixture exception.')
emitter.on('failure', () => {
  throw original
})
assert.throws(
  () => emitter.emit('failure'),
  (error) => error === original
)

const storage = new AsyncLocalStorage()
const resource = storage.run(
  'subscription-context',
  () => new AsyncResource('SubscriptionContextFixture')
)
const receiver = {
  calls: 0,
  next() {
    assert.equal(storage.getStore(), 'subscription-context')
    this.calls++
  }
}
const capturedNext = receiver.next
receiver.next = () => {
  throw new Error('A later callback replacement must not be used in this fixture.')
}
storage.run('different-context', () => resource.runInAsyncScope(capturedNext, receiver))
assert.equal(receiver.calls, 1)
resource.emitDestroy()
storage.disable()

const receipt = {
  purpose:
    'Node scheduling and listener return behavior only; no native bridge or proposed observer implementation',
  nodeVersion: process.version,
  checkedAt: new Date().toISOString(),
  inlineOrder,
  microtaskOrder,
  turnOrder,
  callbackOrder,
  originalSynchronousExceptionPreserved: true,
  capturedAsyncContextFacilityVerified: true,
  capturedCallbackAndReceiverPreserved: true,
  nativeAddonExecuted: false,
  proposedSubscriptionImplementationExecuted: false,
  nativeCallbackExceptionRouteExecuted: false,
  cancellationAndCloseVerified: false,
  queueCapacityVerified: false
}
writeFileSync(
  new URL('./scheduling-contract.json', import.meta.url),
  `${JSON.stringify(receipt, null, 2)}\n`
)
console.log(JSON.stringify(receipt))
