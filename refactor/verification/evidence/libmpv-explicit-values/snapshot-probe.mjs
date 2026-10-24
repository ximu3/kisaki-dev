/** Exercise view copying and retained snapshots using standard JavaScript only. */
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { inspect } from 'node:util'

const backing = new Uint8Array([0xa0, 0xa1, 0x66, 0x80, 0xa2])
const bufferView = Buffer.from(backing.buffer, 2, 2)
const aliased = bufferView.slice()
const captured = new Uint8Array(bufferView)
assert.equal(captured.byteLength, 2)
assert.equal(captured.buffer.byteLength, 2)
assert.deepEqual([...captured], [0x66, 0x80])
bufferView[0] = 0x67
assert.equal(aliased[0], 0x67)
assert.equal(captured[0], 0x66)

class SnapshotFixture extends Error {
  #snapshot
  constructor(value) {
    super('The completed value cannot be converted.')
    this.#snapshot = structuredClone(value)
  }
  copy() {
    return structuredClone(this.#snapshot)
  }
}

const initial = {
  format: 'map',
  value: [[new Uint8Array([0x61]), { format: 'string', value: captured }]]
}
const retained = new SnapshotFixture(initial)
captured[0] = 0x68
initial.value[0][0][0] = 0x62
const first = retained.copy()
assert.equal(first.value[0][0][0], 0x61)
assert.equal(first.value[0][1].value[0], 0x66)
first.value[0][1].value[0] = 0x69
const second = retained.copy()
assert.equal(second.value[0][1].value[0], 0x66)
assert.notEqual(first.value[0][1].value.buffer, second.value[0][1].value.buffer)
assert.equal(inspect(retained).includes('format'), false)
assert.equal(JSON.stringify(retained), '{}')

const receipt = {
  purpose: 'JavaScript snapshot fixture only; no actual MpvConversionError or addon',
  nodeVersion: process.version,
  checkedAt: new Date().toISOString(),
  bufferSliceAliasingObserved: true,
  onlyVisibleBytesCaptured: true,
  capturedBackingBufferHasExactLength: true,
  laterInputMutationDidNotChangeSnapshot: true,
  repeatedCopiesIndependent: true,
  defaultInspectionDidNotExposeSnapshot: true,
  nativeAddonExecuted: false,
  nativeLifetimeVerified: false,
  conversionErrorImplementationVerified: false,
  observationTerminationVerified: false,
  screenshotOrGpuExecuted: false
}
writeFileSync(
  new URL('./snapshot-contract.json', import.meta.url),
  `${JSON.stringify(receipt, null, 2)}\n`
)
console.log(JSON.stringify(receipt))
