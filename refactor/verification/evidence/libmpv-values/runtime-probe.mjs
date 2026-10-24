/** Check JavaScript representation constraints without implementing or loading an addon. */
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { TextDecoder, TextEncoder } from 'node:util'

const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
const encoder = new TextEncoder()
const validTexts = ['', 'ASCII', '\uFEFFtitle', 'e\u0301', '\u00E9', '\u{1F3B5}']
for (const text of validTexts) {
  const bytes = encoder.encode(text)
  assert.equal(decoder.decode(bytes), text)
  assert.deepEqual(encoder.encode(decoder.decode(bytes)), bytes)
}

const invalidSequences = [[0x80], [0xc0, 0xaf], [0xe2, 0x82], [0xed, 0xa0, 0x80]]
for (const bytes of invalidSequences) {
  assert.throws(() => decoder.decode(new Uint8Array(bytes)), TypeError)
}
assert.equal('\uD800'.isWellFormed(), false)
assert.equal(decoder.decode(encoder.encode('\uD800')), '\uFFFD')

const pairs = [
  ['artist', 'A'],
  ['artist', 'B']
]
assert.equal(pairs.length, 2)
assert.equal(Object.fromEntries(pairs).artist, 'B')
assert.equal(new Map(pairs).size, 1)

const record = Object.create(null)
for (const key of ['__proto__', 'constructor', 'toString']) {
  Object.defineProperty(record, key, {
    value: key,
    writable: true,
    enumerable: true,
    configurable: true
  })
  assert.equal(Object.hasOwn(record, key), true)
  assert.equal(record[key], key)
}
assert.equal(Object.getPrototypeOf(record), null)

const receipt = {
  purpose:
    'JavaScript encoding and data representation only; no proposed value classes or addon executed',
  nodeVersion: process.version,
  checkedAt: new Date().toISOString(),
  validUtf8RoundTrips: validTexts.length,
  rejectedInvalidUtf8Sequences: invalidSequences.length,
  loneSurrogateReplacementObserved: true,
  duplicateKeyLossInObjectAndMapObserved: true,
  nullPrototypeSpecialKeysPreserved: true,
  nativeAddonExecuted: false,
  proposedValueClassesExecuted: false,
  screenshotOrGpuExecuted: false
}
writeFileSync(
  new URL('./runtime-contract.json', import.meta.url),
  `${JSON.stringify(receipt, null, 2)}\n`
)
console.log(JSON.stringify(receipt))
