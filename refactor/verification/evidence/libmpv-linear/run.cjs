const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')

const root = path.resolve(__dirname, '../../../..')
const evidence = path.join(root, 'refactor/verification/evidence')
const cache = path.join(root, 'node_modules/.cache/libmpv-design/linear-gamut')
fs.mkdirSync(cache, { recursive: true })
const binary = JSON.parse(fs.readFileSync(path.join(evidence, 'libmpv-native/binary-input.json')))
const previous = JSON.parse(fs.readFileSync(path.join(evidence, 'libmpv-gpu/native-contract.json')))
const referencePath = path.join(evidence, 'libmpv-tonemapping/hdr-contract.json')
const reference = JSON.parse(fs.readFileSync(referencePath))
const addonPath = path.join(
  root,
  'node_modules/.cache/libmpv-design/gpu-target/libmpv-gpu-probe.node'
)
const sources = {
  colors: path.join(root, 'node_modules/.cache/libmpv-design/tonemapping/colors-pq-4000.mkv'),
  steps: path.join(root, 'node_modules/.cache/libmpv-design/tonemapping/steps-pq-4000.mkv')
}
const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
assert.equal(digest(binary.dll), binary.dllSha256)
assert.equal(digest(addonPath), previous.addonSha256)
for (const name of ['producer.cpp', 'binding.rs']) {
  assert.equal(digest(path.join(evidence, 'libmpv-gpu', name)), previous.sources[name])
}
assert.equal(digest(sources.colors), reference.reference.colorSampleSha256)
assert.equal(digest(sources.steps), reference.reference.sampleSha256)
const { produceFrames } = require(addonPath)

function half(bits) {
  const exponent = (bits >>> 10) & 31
  const fraction = bits & 1023
  const sign = bits & 0x8000 ? -1 : 1
  return exponent === 31
    ? fraction
      ? NaN
      : sign * Infinity
    : sign * (exponent ? 2 ** (exponent - 15) * (1 + fraction / 1024) : 2 ** -24 * fraction)
}

async function run() {
  const cases = []
  for (const primaries of ['bt.709', 'display-p3', 'bt.2020']) {
    for (const [kind, gamut] of [
      ['colors', 'auto'],
      ['colors', 'clip'],
      ['steps', 'clip']
    ]) {
      const source = sources[kind]
      const script = path.join(cache, `${primaries}-${kind}-${gamut}.lua`)
      const options = [
        ['target-prim', primaries],
        ['target-trc', 'linear'],
        ['target-peak', '418'],
        ['hdr-compute-peak', 'no'],
        ['gamut-mapping-mode', gamut]
      ]
      const scriptSource =
        options
          .map(
            ([key, value]) =>
              `assert(mp.set_property(${JSON.stringify(key)}, ${JSON.stringify(value)}))`
          )
          .join('\n') +
        `\nassert(mp.commandv("loadfile", ${JSON.stringify(source.replaceAll('\\', '/'))}))\n`
      fs.writeFileSync(script, scriptSource)
      const frames = await produceFrames(binary.dll, '', source, script, true, true, 'scrgb')
      const samples = []
      let device
      try {
        for (const frame of frames) {
          const info = frame.info()
          assert.equal(info.backend, 'd3d11')
          assert.equal(info.pixelFormat, 'rgba16float')
          assert(info.coreDestroyed)
          const actualDevice = {
            vendor: info.vendor,
            device: info.device,
            adapterLuid: info.adapterLuid
          }
          if (device) assert.deepEqual(actualDevice, device)
          else device = actualDevice
          const bytes = frame.pixels()
          const pixels = Array.from({ length: 7 }, (_, index) => {
            const x = Math.floor((info.width * (index + 0.5)) / 7)
            const y = Math.floor(info.height * 0.5)
            return [0, 1, 2, 3].map((channel) =>
              half(bytes.readUInt16LE((y * info.width + x) * 8 + channel * 2))
            )
          })
          assert(pixels.flat().every(Number.isFinite))
          assert(pixels.every((pixel) => pixel[3] === 1))
          samples.push({ width: info.width, height: info.height, pixels })
        }
      } finally {
        for (const frame of frames) frame.release()
      }
      cases.push({
        primaries,
        device,
        kind,
        gamut,
        options,
        scriptSource,
        scriptSha256: digest(script),
        samples
      })
    }
  }
  const angleLoaded = process.report
    .getReport()
    .sharedObjects.some((file) => /^(libEGL|libGLESv2)\.dll$/i.test(path.basename(file)))
  assert.equal(angleLoaded, false)
  const result = {
    checkedAt: new Date().toISOString(),
    node: process.version,
    sources: Object.fromEntries(
      Object.entries(sources).map(([kind, file]) => [
        kind,
        {
          path: file,
          sha256: digest(file)
        }
      ])
    ),
    fixtureReceiptSha256: digest(referencePath),
    addonSha256: digest(addonPath),
    dllSha256: digest(binary.dll),
    scriptSha256: digest(__filename),
    sharedSources: Object.fromEntries(
      ['producer.cpp', 'binding.rs'].map((name) => [
        `libmpv-gpu/${name}`,
        digest(path.join(evidence, 'libmpv-gpu', name))
      ])
    ),
    peakNits: 418,
    nativeNitsPerUnit: 203,
    angleLoaded,
    ownShaderUsed: false,
    hardwareDecodeEnabled: false,
    allReturnedFramesReleased: true,
    displaySettingsChanged: false,
    hostImportVerified: false,
    subtitleVerified: false,
    cases
  }
  fs.writeFileSync(
    path.join(__dirname, 'native-contract.json'),
    JSON.stringify(result, null, 2) + '\n'
  )
  console.log(
    JSON.stringify({
      cases: cases.length,
      frames: cases.reduce((n, item) => n + item.samples.length, 0),
      angleLoaded,
      allReturnedFramesReleased: true
    })
  )
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
