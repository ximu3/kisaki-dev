import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const inputs = JSON.parse(readFileSync(new URL('./source-input.json', import.meta.url), 'utf8'))
const scene = inputs.cases.find((value) => value.name === process.argv[2])
assert(scene)
const { produceFrames, angleLibrariesLoaded } = createRequire(import.meta.url)(inputs.addon)
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const samples = (bytes, width, height, stride, bgra = false) =>
  scene.points.map(([x, y]) => {
    const offset = Math.floor(y * height) * stride + Math.floor(x * width) * 4
    const pixel = [...bytes.subarray(offset, offset + 4)]
    return bgra ? [pixel[2], pixel[1], pixel[0], pixel[3]] : pixel
  })

assert.equal(angleLibrariesLoaded(), false)
const frames = await produceFrames(
  inputs.dll.path,
  '',
  scene.media,
  scene.script,
  true,
  true,
  'srgb'
)
let screenshot
let result
try {
  assert.equal(frames.length, 2)
  const info = frames[0].info()
  assert.equal(info.coreDestroyed, true)
  assert.equal(info.backend, 'd3d11')
  assert.equal(info.pixelFormat, 'bgra8unorm')
  const pixels = frames[0].pixels()
  screenshot = frames[0].screenshot()
  const width = Number(info.screenshotWidth)
  const height = Number(info.screenshotHeight)
  const stride = Number(info.screenshotStride)
  assert.equal(screenshot.format, 'rgba')
  assert(width > 0 && height > 0 && stride >= width * 4)
  assert.equal(screenshot.data.length, Number(info.screenshotBytes))
  assert.equal(screenshot.data.length, stride * height)
  // Padding is native allocation detail and is excluded from pixel hashes.
  const rows = Array.from({ length: height }, (_, y) =>
    screenshot.data.subarray(y * stride, y * stride + width * 4)
  )
  const activeHash = hash(Buffer.concat(rows))
  result = {
    node: process.version,
    observed: JSON.parse(readFileSync(scene.metadata, 'utf8')),
    frame: { ...info, samples: samples(pixels, info.width, info.height, info.width * 4, true) },
    screenshot: {
      width,
      height,
      stride,
      byteLength: screenshot.data.length,
      format: screenshot.format,
      samples: samples(screenshot.data, width, height, stride),
      activeRowsSha256: activeHash
    }
  }
} finally {
  for (const frame of frames) frame.release()
}
for (const frame of frames) assert.throws(() => frame.pixels())
assert.equal(angleLibrariesLoaded(), false)
const { width, height, stride } = result.screenshot
assert.equal(
  hash(
    Buffer.concat(
      Array.from({ length: height }, (_, y) =>
        screenshot.data.subarray(y * stride, y * stride + width * 4)
      )
    )
  ),
  result.screenshot.activeRowsSha256
)
result.independentBytesAfterCoreAndFrameRelease = true
writeFileSync(scene.output, `${JSON.stringify(result, null, 2)}\n`)
