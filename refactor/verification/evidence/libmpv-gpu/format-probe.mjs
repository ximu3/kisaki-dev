import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const [addonPath, dll, image, opaque, translucent] = process.argv.slice(2)
const { produceFrames, angleLibrariesLoaded } = createRequire(import.meta.url)(addonPath)
const half = (bits) => {
  const exponent = (bits >>> 10) & 31
  const fraction = bits & 1023
  const sign = bits & 0x8000 ? -1 : 1
  if (exponent === 31) return fraction ? NaN : sign * Infinity
  return (
    sign * (exponent ? 2 ** (exponent - 15) * (1 + fraction / 1024) : (2 ** -14 * fraction) / 1024)
  )
}

function samples(frame) {
  const info = frame.info()
  const bytes = frame.pixels()
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const size = info.pixelFormat === 'rgba16float' ? 8 : 4
  return [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
    [0.5, 0.5]
  ].map(([x, y]) => {
    const offset = (Math.floor(y * info.height) * info.width + Math.floor(x * info.width)) * size
    return size === 8
      ? [0, 1, 2, 3].map((channel) => half(data.getUint16(offset + channel * 2, true)))
      : [...bytes.subarray(offset, offset + 4)]
  })
}

const results = []
for (const setup of [
  { target: 'scrgb', source: image },
  { target: 'pq', source: image },
  { target: 'transparent', source: opaque },
  { target: 'transparent', source: translucent },
  { target: 'blank', source: '' }
]) {
  const frames = await produceFrames(dll, '', setup.source, '', true, true, setup.target)
  try {
    const info = frames[0].info()
    const values = samples(frames[0])
    assert.equal(info.backend, 'd3d11')
    assert.equal(info.target, setup.target)
    assert(values.flat().every(Number.isFinite))
    if (setup.target === 'blank') {
      assert(
        values.every(
          (pixel) => pixel[0] === 0 && pixel[1] === 0 && pixel[2] === 0 && pixel[3] === 255
        )
      )
    } else if (setup.target !== 'transparent') {
      assert.equal(info.pixelFormat, 'rgba16float')
      assert(values.every((pixel) => pixel[3] === 1))
      if (setup.target === 'scrgb') {
        assert(Math.abs(values[3][0] - 203 / 80) > 0.1)
      } else
        assert(
          values.every((pixel) => pixel.slice(0, 3).every((value) => value >= 0 && value <= 1))
        )
    }
    results.push({
      target: setup.target,
      source: setup.source,
      pixelFormat: info.pixelFormat,
      values,
      ...(setup.target === 'scrgb'
        ? { scrgb80NitsCompatible: false, expectedReferenceWhite: 203 / 80 }
        : {})
    })
  } finally {
    for (const frame of frames) frame.release()
  }
}
assert.equal(angleLibrariesLoaded(), false)
const opaqueValues = results[2].values
const translucentValues = results[3].values
const encodedPremultiplicationMatches = translucentValues.every((pixel, index) =>
  pixel
    .slice(0, 3)
    .every(
      (value, channel) => Math.abs(value - (opaqueValues[index][channel] * pixel[3]) / 255) <= 2
    )
)
const white = results[1].values[3][0]
const m1 = 2610 / 16384,
  m2 = 2523 / 32,
  c1 = 3424 / 4096,
  c2 = 2413 / 128,
  c3 = 2392 / 128
const powered = white ** (1 / m2)
const pqWhiteNits = 10000 * (Math.max(powered - c1, 0) / (c2 - c3 * powered)) ** (1 / m1)
assert(Math.abs(pqWhiteNits - 203) < 2)
process.stdout.write(
  `${JSON.stringify({ results, pqWhiteNits, encodedPremultiplicationMatches, angleLibrariesLoaded: false })}\n`
)
