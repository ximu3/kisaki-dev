import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const [addonPath, dll, movie] = process.argv.slice(2)
const { testFramePressure, angleLibrariesLoaded } = createRequire(import.meta.url)(addonPath)
const cases = []
for (const capacity of [2, 3]) {
  const result = await testFramePressure(dll, movie, capacity)
  assert.equal(result.produced, capacity)
  assert(result.skipped > 0 && result.heldFramesStable)
  assert(result.maxPosition >= 1 && result.elapsedSeconds >= 1)
  const target = BigInt(result.firstTargetRaw)
  const clockNs = BigInt(result.clockAtTargetNs)
  const clockUs = BigInt(result.clockAtTargetUs)
  const distance = (left, right) => (left > right ? left - right : right - left)
  assert(target > 0n)
  assert(distance(target, clockNs) < 250_000_000n)
  assert(distance(clockUs * 1000n, clockNs) < 5_000_000n)
  assert(distance(target * 1000n, clockNs) > 1_000_000_000n)
  assert.equal(result.audioCodec, 'pcm_s16le')
  cases.push({ ...result, targetTimeUnit: 'nanoseconds' })
}
assert.equal(angleLibrariesLoaded(), false)
process.stdout.write(`${JSON.stringify({ cases, angleLibrariesLoaded: false })}\n`)
