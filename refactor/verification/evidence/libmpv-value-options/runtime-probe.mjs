/** Probe JavaScript transport and error boundaries; these fixtures are not an addon implementation. */
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { inspect, types } from 'node:util'
import { runInNewContext } from 'node:vm'
import { MessageChannel, receiveMessageOnPort } from 'node:worker_threads'

function sendValue(value) {
  const { port1, port2 } = new MessageChannel()
  try {
    port1.postMessage(value)
    const received = receiveMessageOnPort(port2)
    assert.ok(received)
    return received.message
  } finally {
    port1.close()
    port2.close()
  }
}

class ByteHolder {
  #bytes
  constructor(bytes) {
    this.#bytes = bytes.slice()
  }
  toBytes() {
    return this.#bytes.slice()
  }
}

class EntryHolder {
  constructor(entries) {
    this.entries = entries
  }
}

const byteHolder = new ByteHolder(new Uint8Array([0x66, 0x80]))
const copiedHolder = sendValue(byteHolder)
assert.equal(copiedHolder instanceof ByteHolder, false)
assert.deepEqual(Object.keys(copiedHolder), [])
assert.equal(copiedHolder.toBytes, undefined)

const entryHolder = new EntryHolder([
  ['a', 1n],
  ['a', 2n]
])
const copiedEntries = sendValue(entryHolder)
assert.equal(copiedEntries instanceof EntryHolder, false)
assert.deepEqual(copiedEntries.entries, entryHolder.entries)

const nativeValue = {
  format: 'map',
  entries: [
    [new Uint8Array([0x61]), { format: 'int64', value: 9223372036854775807n }],
    [new Uint8Array([0x61]), { format: 'string', bytes: new Uint8Array([0x80]) }],
    [new Uint8Array([0x62]), { format: 'bytes', bytes: new Uint8Array([0, 255]) }],
    [new Uint8Array([0x63]), { format: 'double', value: -0 }],
    [new Uint8Array([0x64]), { format: 'double', value: NaN }]
  ]
}
const copiedNative = sendValue(nativeValue)
assert.deepEqual(copiedNative, nativeValue)
assert.notEqual(copiedNative.entries[1][1].bytes, nativeValue.entries[1][1].bytes)
assert.equal(Object.is(copiedNative.entries[3][1].value, -0), true)
assert.equal(Number.isNaN(copiedNative.entries[4][1].value), true)
assert.throws(() => JSON.stringify(nativeValue), TypeError)

const record = Object.create(null)
Object.defineProperty(record, '__proto__', { value: 'data', enumerable: true })
const copiedRecord = sendValue(record)
assert.equal(Object.getPrototypeOf(copiedRecord), Object.prototype)
assert.equal(Object.hasOwn(copiedRecord, '__proto__'), true)
assert.equal(copiedRecord.__proto__, 'data')

const otherRealmBytes = runInNewContext('new Uint8Array([1, 2])')
assert.equal(otherRealmBytes instanceof Uint8Array, false)
assert.equal(types.isUint8Array(otherRealmBytes), true)

class ValueFailure extends Error {
  #nativeValue
  constructor(value) {
    super('The completed result cannot be represented in the requested form.')
    this.name = 'ValueFailure'
    this.code = 'valueConversion'
    this.#nativeValue = value
  }
  get nativeValue() {
    return this.#nativeValue
  }
}

const privateMarker = 'probe-private-metadata'
const failure = new ValueFailure({
  format: 'string',
  bytes: new TextEncoder().encode(privateMarker)
})
assert.equal(inspect(failure).includes(privateMarker), false)
assert.equal(inspect(failure).includes('nativeValue'), false)
assert.equal(JSON.stringify(failure).includes(privateMarker), false)
assert.equal(new TextDecoder().decode(failure.nativeValue.bytes), privateMarker)
const copiedFailure = sendValue(failure)
assert.equal(copiedFailure instanceof Error, true)
assert.equal(copiedFailure instanceof ValueFailure, false)
assert.equal(copiedFailure.code, undefined)
assert.equal(copiedFailure.nativeValue, undefined)
assert.deepEqual(sendValue(failure.nativeValue), failure.nativeValue)

const receipt = {
  purpose:
    'Actual Node message serialization, realm and diagnostic behavior; no player or candidate API execution',
  nodeVersion: process.version,
  checkedAt: new Date().toISOString(),
  classIdentityLostOnMessage: true,
  privateClassBytesNotSerialized: true,
  publicEntriesSurvivedWithoutClassIdentity: true,
  taggedNativeDataSurvivedMessage: true,
  bigintNegativeZeroAndNaNPreserved: true,
  nullPrototypeChangedButOwnSpecialKeyPreserved: true,
  crossRealmInstanceofMismatchObserved: true,
  defaultInspectionDidNotExposePrivateResult: true,
  customErrorFieldsNotPreservedByMessage: true,
  extractedResultSurvivedMessage: true,
  nativeAddonExecuted: false,
  nativeCommandsExecuted: false,
  candidateInterfacesImplemented: false,
  performanceBenchmarked: false,
  screenshotOrGpuExecuted: false
}
writeFileSync(
  new URL('./runtime-contract.json', import.meta.url),
  `${JSON.stringify(receipt, null, 2)}\n`
)
console.log(JSON.stringify(receipt))
