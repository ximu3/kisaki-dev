/** Compare legacy and gpu-next entry points in the same pinned upstream artifact. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../..')
const binary = JSON.parse(await readFile(path.join(here, 'binary-input.json'), 'utf8'))
const inputs = JSON.parse(
  await readFile(path.join(here, '../libmpv-gpu/binary-input.json'), 'utf8')
)
const native = JSON.parse(
  await readFile(path.join(here, '../libmpv-gpu/native-contract.json'), 'utf8')
)
const addon = path.join(root, 'node_modules/.cache/libmpv-design/gpu-target/libmpv-gpu-probe.node')
const cache = path.join(root, 'node_modules/.cache/libmpv-design/renderer-upstream/scripts')
const hash = (data) => createHash('sha256').update(data).digest('hex')
assert.equal(hash(await readFile(binary.dll)), binary.dllSha256)
assert.equal(hash(await readFile(addon)), native.addonSha256)
for (const [name, expected] of Object.entries(inputs.angle.files))
  assert.equal(hash(await readFile(path.join(inputs.angle.directory, name))), expected)
await mkdir(cache, { recursive: true })
const { produceFrames } = createRequire(import.meta.url)(addon)

function half(bits) {
  const exponent = (bits >>> 10) & 31
  const fraction = bits & 1023
  const sign = bits & 0x8000 ? -1 : 1
  if (exponent === 31) return fraction ? NaN : sign * Infinity
  return sign * (exponent ? 2 ** (exponent - 15) * (1 + fraction / 1024) : 2 ** -24 * fraction)
}

function samples(frame) {
  const info = frame.info()
  const bytes = frame.pixels()
  const floating = info.pixelFormat === 'rgba16float'
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
    [0.5, 0.5]
  ].map(([x, y]) => {
    const offset =
      (Math.floor(y * info.height) * info.width + Math.floor(x * info.width)) * (floating ? 8 : 4)
    return floating
      ? [0, 1, 2, 3].map((channel) => half(data.getUint16(offset + channel * 2, true)))
      : [...bytes.subarray(offset, offset + 4)]
  })
}

const cases = []
for (const api of ['opengl', 'opengl-next']) {
  for (const colorSpace of ['srgb', 'display-p3', 'bt2020-pq', 'bt2020-hlg', 'linear-rgb']) {
    const floating = !['srgb', 'display-p3'].includes(colorSpace)
    const primaries =
      colorSpace === 'display-p3'
        ? 'display-p3'
        : colorSpace.startsWith('bt2020')
          ? 'bt.2020'
          : 'bt.709'
    const transfer =
      colorSpace === 'bt2020-pq'
        ? 'pq'
        : colorSpace === 'bt2020-hlg'
          ? 'hlg'
          : colorSpace === 'linear-rgb'
            ? 'linear'
            : 'srgb'
    for (const linearDown of [false, true]) {
      for (const source of inputs.alphaSamples) {
        assert.equal(hash(await readFile(source.path)), source.sha256)
        const name = `${api}-${colorSpace}-${linearDown}-${source.alpha}`
        const script = path.join(cache, `${name}.lua`)
        await writeFile(
          script,
          [
            `mp.set_property("target-prim", "${primaries}")`,
            `mp.set_property("target-trc", "${transfer}")`,
            'mp.set_property("background", "none")',
            `mp.set_property("linear-downscaling", "${linearDown ? 'yes' : 'no'}")`,
            `mp.commandv("loadfile", ${JSON.stringify(source.path.replaceAll('\\', '/'))})`,
            ''
          ].join('\n')
        )
        const frames = await produceFrames(
          binary.dll,
          inputs.angle.directory,
          source.path,
          script,
          true,
          false,
          floating ? 'pq' : 'transparent',
          api === 'opengl-next'
        )
        try {
          assert(
            frames.every((frame) => frame.info().coreDestroyed && frame.info().rawVoChangeSucceeded)
          )
          cases.push({
            api,
            colorSpace,
            linearDown,
            sourceAlpha: source.alpha,
            adapter: {
              luid: frames[0].info().adapterLuid,
              vendor: frames[0].info().vendor,
              device: frames[0].info().device
            },
            frames: frames.map((frame) => ({
              width: frame.info().width,
              height: frame.info().height,
              pixelFormat: frame.info().pixelFormat,
              samples: samples(frame)
            }))
          })
        } finally {
          for (const frame of frames) frame.release()
        }
      }
    }
  }
}
const comparisons = []
for (let index = 0; index < cases.length; index += 2) {
  const opaque = cases[index]
  const translucent = cases[index + 1]
  for (let size = 0; size < 2; size++) {
    const original = opaque.frames[size]
    const result = translucent.frames[size]
    const alphaMaximum = result.pixelFormat === 'rgba16float' ? 1 : 255
    assert(result.samples.flat().every(Number.isFinite))
    const straightDeviation = Math.max(
      ...result.samples.flatMap((pixel, at) =>
        pixel.slice(0, 3).map((value, channel) => Math.abs(value - original.samples[at][channel]))
      )
    )
    const premultipliedDeviation = Math.max(
      ...result.samples.flatMap((pixel, at) =>
        pixel
          .slice(0, 3)
          .map((value, channel) =>
            Math.abs(value - (original.samples[at][channel] * pixel[3]) / alphaMaximum)
          )
      )
    )
    comparisons.push({
      api: opaque.api,
      colorSpace: opaque.colorSpace,
      linearDown: opaque.linearDown,
      width: result.width,
      pixelFormat: result.pixelFormat,
      straightDeviation,
      premultipliedDeviation,
      alpha: result.samples.map((pixel) => pixel[3])
    })
  }
}
const receipt = {
  checkedAt: new Date().toISOString(),
  node: process.version,
  dllSha256: binary.dllSha256,
  addonSha256: native.addonSha256,
  requestedApis: ['opengl', 'opengl-next'],
  cases,
  comparisons,
  physicalHdrDisplayVerified: false,
  hdrTargetPixelsExecuted: true,
  hdrSourceToneMappingVerified: false,
  electronImportExecuted: false,
  selectedForRelease: false,
  sourceSha256: hash(await readFile(fileURLToPath(import.meta.url)))
}
for (const item of comparisons.filter((row) => row.api === 'opengl-next')) {
  assert(item.straightDeviation <= (item.pixelFormat === 'rgba16float' ? 0.002 : 1))
  assert(
    item.alpha.every(
      (alpha) => Math.abs(alpha - (item.pixelFormat === 'rgba16float' ? 128 / 255 : 128)) <= 0.002
    )
  )
}
assert(
  comparisons.some(
    (row) =>
      row.api === 'opengl' && row.colorSpace === 'display-p3' && row.premultipliedDeviation > 2
  )
)
await writeFile(path.join(here, 'native-contract.json'), `${JSON.stringify(receipt, null, 2)}\n`)
process.stdout.write(
  `${JSON.stringify({
    cases: cases.length,
    next: comparisons
      .filter((item) => item.api === 'opengl-next')
      .map(({ colorSpace, width, linearDown, straightDeviation, pixelFormat }) => ({
        colorSpace,
        width,
        linearDown,
        straightDeviation,
        pixelFormat
      }))
  })}\n`
)
