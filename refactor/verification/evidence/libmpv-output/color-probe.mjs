/** Isolated color experiments through the existing native producer. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../..')
const cache = path.join(root, 'node_modules/.cache/libmpv-design/output-probe')
const input = JSON.parse(await readFile(path.join(here, '../libmpv-gpu/binary-input.json'), 'utf8'))
const native = JSON.parse(
  await readFile(path.join(here, '../libmpv-gpu/native-contract.json'), 'utf8')
)
const binary = JSON.parse(
  await readFile(path.join(here, '../libmpv-native/binary-input.json'), 'utf8')
)
const addon = path.join(root, 'node_modules/.cache/libmpv-design/gpu-target/libmpv-gpu-probe.node')
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
assert.equal(digest(await readFile(addon)), native.addonSha256)
assert.equal(digest(await readFile(binary.dll)), binary.dllSha256)
await mkdir(cache, { recursive: true })
const { produceFrames, angleLibrariesLoaded } = createRequire(import.meta.url)(addon)

const half = (bits) => {
  const exponent = (bits >>> 10) & 31
  const fraction = bits & 1023
  const sign = bits & 0x8000 ? -1 : 1
  if (exponent === 31) return fraction ? NaN : sign * Infinity
  return sign * (exponent ? 2 ** (exponent - 15) * (1 + fraction / 1024) : 2 ** -24 * fraction)
}

function sample(frame) {
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

const shader = path.join(cache, 'scrgb-scale.glsl')
await writeFile(
  shader,
  `//!HOOK OUTPUT
//!BIND HOOKED
vec4 hook() {
    vec4 value = HOOKED_tex(HOOKED_pos);
    return vec4(value.rgb * 125.0, value.a);
}
`
)
const linearShader = path.join(cache, 'linear-to-scrgb.glsl')
await writeFile(
  linearShader,
  `//!HOOK OUTPUT
//!BIND HOOKED
vec4 hook() {
    vec4 value = HOOKED_tex(HOOKED_pos);
    return vec4(value.rgb * 2.5375, value.a);
}
`
)
const alphaShader = path.join(cache, 'alpha-color-hooks.glsl')
await writeFile(
  alphaShader,
  `//!HOOK SCALED
//!BIND HOOKED
vec4 hook() {
    vec4 value = HOOKED_tex(HOOKED_pos);
    return value.a > 0.0 ? vec4(value.rgb / value.a, value.a) : vec4(0.0);
}
//!HOOK OUTPUT
//!BIND HOOKED
vec4 hook() {
    vec4 value = HOOKED_tex(HOOKED_pos);
    return vec4(value.rgb * value.a, value.a);
}
`
)

const cases = []
for (const setup of [
  { name: 'scrgb-native', target: 'scrgb', source: input.sample, options: [] },
  {
    name: 'scrgb-output-scale',
    target: 'scrgb',
    source: input.sample,
    options: [['glsl-shaders', shader.replaceAll('\\', '/')]]
  },
  {
    name: 'pq-opaque',
    target: 'pq',
    source: input.alphaSamples[0],
    options: [['background', 'none']]
  },
  {
    name: 'pq-half-alpha',
    target: 'pq',
    source: input.alphaSamples[1],
    options: [['background', 'none']]
  },
  {
    name: 'display-p3-opaque',
    target: 'transparent',
    source: input.alphaSamples[0],
    options: [['target-prim', 'display-p3']]
  },
  {
    name: 'display-p3-half-alpha',
    target: 'transparent',
    source: input.alphaSamples[1],
    options: [['target-prim', 'display-p3']]
  },
  {
    name: 'linear-1000',
    target: 'scrgb',
    source: input.sample,
    options: [['target-trc', 'linear']]
  },
  {
    name: 'linear-1000-to-scrgb80',
    target: 'scrgb',
    source: input.sample,
    options: [
      ['target-trc', 'linear'],
      ['glsl-shaders', linearShader.replaceAll('\\', '/')]
    ]
  },
  {
    name: 'pq-alpha-hooks-opaque',
    target: 'pq',
    source: input.alphaSamples[0],
    options: [
      ['background', 'none'],
      ['glsl-shaders', alphaShader.replaceAll('\\', '/')]
    ]
  },
  {
    name: 'pq-alpha-hooks-half',
    target: 'pq',
    source: input.alphaSamples[1],
    options: [
      ['background', 'none'],
      ['glsl-shaders', alphaShader.replaceAll('\\', '/')]
    ]
  },
  {
    name: 'p3-alpha-hooks-opaque',
    target: 'transparent',
    source: input.alphaSamples[0],
    options: [
      ['target-prim', 'display-p3'],
      ['glsl-shaders', alphaShader.replaceAll('\\', '/')]
    ]
  },
  {
    name: 'p3-alpha-hooks-half',
    target: 'transparent',
    source: input.alphaSamples[1],
    options: [
      ['target-prim', 'display-p3'],
      ['glsl-shaders', alphaShader.replaceAll('\\', '/')]
    ]
  },
  {
    name: 'pq-alpha-hooks-linear-down-opaque',
    target: 'pq',
    source: input.alphaSamples[0],
    options: [
      ['background', 'none'],
      ['linear-downscaling', 'yes'],
      ['glsl-shaders', alphaShader.replaceAll('\\', '/')]
    ]
  },
  {
    name: 'pq-alpha-hooks-linear-down-half',
    target: 'pq',
    source: input.alphaSamples[1],
    options: [
      ['background', 'none'],
      ['linear-downscaling', 'yes'],
      ['glsl-shaders', alphaShader.replaceAll('\\', '/')]
    ]
  }
]) {
  assert.equal(digest(await readFile(setup.source.path)), setup.source.sha256)
  const script = path.join(cache, `${setup.name}.lua`)
  const lines = setup.options.map(
    ([name, value]) => `mp.set_property(${JSON.stringify(name)}, ${JSON.stringify(value)})`
  )
  lines.push(`mp.commandv("loadfile", ${JSON.stringify(setup.source.path.replaceAll('\\', '/'))})`)
  await writeFile(script, `${lines.join('\n')}\n`)
  const frames = await produceFrames(
    binary.dll,
    '',
    setup.source.path,
    script,
    true,
    true,
    setup.target
  )
  try {
    assert(frames.every((frame) => frame.info().coreDestroyed))
    const values = sample(frames[0])
    assert(values.flat().every(Number.isFinite))
    cases.push({
      name: setup.name,
      format: frames[0].info().pixelFormat,
      values,
      resizedValues: sample(frames[1])
    })
  } finally {
    for (const frame of frames) frame.release()
  }
}
assert.equal(angleLibrariesLoaded(), false)
const normalizedWhite = cases[1].values[3][0]
assert(Math.abs(normalizedWhite - 203 / 80) < 0.01)
assert(Math.abs(cases[7].values[3][0] - 203 / 80) < 0.01)
const deviation = (opaque, translucent, maximum) =>
  Math.max(
    ...translucent.flatMap((pixel, index) =>
      pixel
        .slice(0, 3)
        .map((value, channel) => Math.abs(value - (opaque[index][channel] * pixel[3]) / maximum))
    )
  )
const result = {
  checkedAt: new Date().toISOString(),
  node: process.version,
  addonSha256: native.addonSha256,
  dllSha256: binary.dllSha256,
  cases,
  scrgbReferenceWhite: normalizedWhite,
  linearWhite: cases[6].values[3][0],
  linearScaledWhite: cases[7].values[3][0],
  linearScalingMatchesScRgb: Math.abs(cases[7].values[3][0] - 203 / 80) < 0.01,
  pqEncodedPremultiplicationDeviation: deviation(cases[2].values, cases[3].values, 1),
  p3EncodedPremultiplicationDeviation: deviation(cases[4].values, cases[5].values, 255),
  pqAlphaHookDeviation: deviation(cases[8].values, cases[9].values, 1),
  p3AlphaHookDeviation: deviation(cases[10].values, cases[11].values, 255),
  pqAlphaHookLinearDownDeviation: deviation(cases[12].resizedValues, cases[13].resizedValues, 1),
  normalizationIsProbeSpecific: true,
  alphaHookPrototypeExecuted: true,
  completeAlphaContractVerified: false,
  physicalHdrDisplayVerified: false,
  angleLibrariesLoaded: false,
  sourceSha256: digest(await readFile(fileURLToPath(import.meta.url)))
}
assert(result.pqEncodedPremultiplicationDeviation > 0.01)
assert(result.p3EncodedPremultiplicationDeviation > 2)
assert(result.pqAlphaHookDeviation < 0.001)
assert(result.p3AlphaHookDeviation < 1)
assert(result.pqAlphaHookLinearDownDeviation > 0.01)
await writeFile(path.join(here, 'color-contract.json'), `${JSON.stringify(result, null, 2)}\n`)
process.stdout.write(
  `${JSON.stringify({
    cases: cases.length,
    scrgbReferenceWhite: normalizedWhite,
    linearWhite: result.linearWhite,
    linearScaledWhite: result.linearScaledWhite,
    pqAlphaHookDeviation: result.pqAlphaHookDeviation,
    pqAlphaHookLinearDownDeviation: result.pqAlphaHookLinearDownDeviation,
    pqEncodedPremultiplicationDeviation: result.pqEncodedPremultiplicationDeviation,
    p3EncodedPremultiplicationDeviation: result.p3EncodedPremultiplicationDeviation
  })}\n`
)
