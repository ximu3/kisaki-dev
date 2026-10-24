import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'

const [addonPath, dll, angle, media, script, backend = 'angle'] = process.argv.slice(2)
const { produceFrames, angleLibrariesLoaded } = createRequire(import.meta.url)(addonPath)
const direct = backend === 'd3d11'
assert(['angle', 'd3d11'].includes(backend))
const angleLoadedBefore = angleLibrariesLoaded()
assert.equal(angleLoadedBefore, false)
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')

function quadrants(bytes, width, height) {
  return [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75]
  ].map(([x, y]) => {
    const start = (Math.floor(y * height) * width + Math.floor(x * width)) * 4
    return [...bytes.subarray(start, start + 4)]
  })
}
const expected = [
  [0, 0, 255, 255],
  [0, 255, 0, 255],
  [255, 0, 0, 255],
  [255, 255, 255, 255]
]
const cases = []
for (const setup of [
  { before: false, script: '' },
  { before: true, script: '' },
  { before: true, script }
]) {
  const frames = await produceFrames(
    dll,
    direct ? '' : angle,
    media,
    setup.script,
    setup.before,
    direct
  )
  const observations = []
  try {
    assert.equal(frames.length, 2)
    for (const frame of frames) {
      const info = frame.info()
      assert.equal(info.backend, backend)
      const pixels = frame.pixels()
      const samples = quadrants(pixels, info.width, info.height)
      assert.equal(info.coreDestroyed, true)
      assert.deepEqual(samples, expected)
      assert.equal(frame.handle().length, 8)
      observations.push({ ...info, samples, sha256: hash(pixels) })
    }
    const screenshot = frames[0].screenshot()
    const info = observations[0]
    assert.equal(info.screenshotWidth, '63')
    assert.equal(info.screenshotHeight, '47')
    assert.equal(Number(info.screenshotBytes), screenshot.data.length)
    assert(Number(info.screenshotStride) >= 63 * 4)
    assert(screenshot.data.length >= Number(info.screenshotStride) * 46 + 63 * 4)
    assert.equal(screenshot.format, 'bgr0')
    const screenshotSamples = [
      [0.25, 0.25],
      [0.75, 0.25],
      [0.25, 0.75],
      [0.75, 0.75]
    ].map(([x, y]) => {
      const offset = Math.floor(y * 47) * Number(info.screenshotStride) + Math.floor(x * 63) * 4
      return [...screenshot.data.subarray(offset, offset + 3)]
    })
    assert.deepEqual(
      screenshotSamples,
      expected.map((pixel) => pixel.slice(0, 3))
    )
    cases.push({
      setup,
      frames: observations,
      screenshot: {
        format: screenshot.format,
        samples: screenshotSamples,
        sha256: hash(screenshot.data),
        bytes: screenshot.data.length
      }
    })
  } finally {
    for (const frame of frames) {
      frame.release()
      frame.release()
    }
  }
  for (const frame of frames) assert.throws(() => frame.pixels())
}
const angleLoadedAfter = angleLibrariesLoaded()
if (direct) assert.equal(angleLoadedAfter, false)
process.stdout.write(
  `${JSON.stringify({ node: process.version, backend, angleLoadedBefore, angleLoadedAfter, cases })}\n`
)
