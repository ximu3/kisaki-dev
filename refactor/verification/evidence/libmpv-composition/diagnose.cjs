const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '../../../..')
const evidence = path.join(root, 'refactor/verification/evidence')
const cache = path.join(root, 'node_modules/.cache/libmpv-design/composition')
fs.mkdirSync(cache, { recursive: true })
const binary = JSON.parse(fs.readFileSync(path.join(evidence, 'libmpv-native/binary-input.json')))
const native = JSON.parse(fs.readFileSync(path.join(evidence, 'libmpv-gpu/native-contract.json')))
const addon = path.join(root, 'node_modules/.cache/libmpv-design/gpu-target/libmpv-gpu-probe.node')
const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
assert.equal(digest(binary.dll), binary.dllSha256)
assert.equal(digest(addon), native.addonSha256)
const { produceFrames } = require(addon)
const ffmpeg = execFileSync('where.exe', ['ffmpeg'], { encoding: 'utf8', windowsHide: true })
  .trim()
  .split(/\r?\n/)[0]
const source = path.join(cache, 'black-pq-4000.mkv')
const arguments = [
  '-v',
  'error',
  '-nostdin',
  '-y',
  '-f',
  'lavfi',
  '-i',
  'color=black:s=224x64:r=1',
  '-frames:v',
  '1',
  '-color_range',
  'tv',
  '-color_primaries',
  'bt2020',
  '-color_trc',
  'smpte2084',
  '-colorspace',
  'bt2020nc',
  '-an',
  '-c:v',
  'libx265',
  '-pix_fmt',
  'yuv420p10le',
  '-x265-params',
  'lossless=1:keyint=1:repeat-headers=1:log-level=error:pools=1:frame-threads=1:' +
    'master-display=G(8500,39850)B(6550,2300)R(35400,14600)WP(15635,16450)L(40000000,50):max-cll=4000,1000',
  '-fflags',
  '+bitexact',
  '-flags:v',
  '+bitexact',
  source
]
execFileSync(ffmpeg, arguments, { windowsHide: true, timeout: 20000 })
const sdrSource = path.join(cache, 'gray-bt709-sdr.mkv')
const sdrArguments = [
  '-v',
  'error',
  '-nostdin',
  '-y',
  '-f',
  'lavfi',
  '-i',
  'color=gray:s=224x64:r=1',
  '-frames:v',
  '1',
  '-color_range',
  'tv',
  '-color_primaries',
  'bt709',
  '-color_trc',
  'bt709',
  '-colorspace',
  'bt709',
  '-an',
  '-c:v',
  'libx264',
  '-qp',
  '0',
  '-pix_fmt',
  'yuv420p',
  '-threads',
  '1',
  '-fflags',
  '+bitexact',
  '-flags:v',
  '+bitexact',
  sdrSource
]
execFileSync(ffmpeg, sdrArguments, { windowsHide: true, timeout: 20000 })

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
  const compositionPath = path.join(__dirname, 'native-contract.json')
  const composition = JSON.parse(fs.readFileSync(compositionPath))
  const subtitleTemplate = composition.cases.find((item) => item.name === 'both-low-peak')
  assert(subtitleTemplate)
  const setups = [
    ['linear', 418, 'auto'],
    ['linear', 418, 'clip'],
    ['linear', 418, 'hable'],
    ['linear', 4000, 'auto'],
    ['pq', 418, 'auto'],
    ['srgb', 203, 'auto']
  ].map(([transfer, peak, tone]) => ({ kind: 'black', transfer, peak, tone }))
  setups.push(
    ...[
      ['linear', 100, 'auto'],
      ['linear', 100, 'clip'],
      ['linear', 100, 'hable'],
      ['linear', 100, 'linear'],
      ['linear', 100, 'mobius'],
      ['linear', 202, 'auto'],
      ['linear', 203, 'auto'],
      ['pq', 100, 'auto'],
      ['srgb', 100, 'auto']
    ].map(([transfer, peak, tone]) => ({ kind: 'subtitles', transfer, peak, tone }))
  )
  setups.push(
    ...[
      ['linear', 100, 'auto'],
      ['linear', 203, 'auto'],
      ['srgb', 203, 'auto']
    ].map(([transfer, peak, tone]) => ({ kind: 'sdr-subtitles', transfer, peak, tone }))
  )
  for (const primaries of ['bt.709', 'display-p3']) {
    for (const kind of ['subtitles', 'sdr-subtitles']) {
      setups.push({ kind, transfer: 'linear', peak: 100, tone: 'auto', primaries })
    }
  }
  setups.push({
    kind: 'sdr-subtitles',
    transfer: 'srgb',
    peak: 203,
    tone: 'auto',
    primaries: 'bt.709'
  })
  for (const { kind, transfer, peak, tone, primaries = 'bt.2020' } of setups) {
    const name = `${kind}-${transfer}-${peak}-${tone}-${primaries}`
    const script = path.join(cache, `${name}.lua`)
    const options = [
      ['target-prim', primaries],
      ['target-trc', transfer],
      ['target-peak', String(peak)],
      ['hdr-compute-peak', 'no'],
      ['gamut-mapping-mode', 'clip'],
      ['tone-mapping', tone],
      ['background', 'color'],
      ['background-color', '#000000'],
      ['video-aspect-override', '4:3']
    ]
    let text =
      options
        .map(
          ([key, value]) =>
            `assert(mp.set_property(${JSON.stringify(key)}, ${JSON.stringify(value)}))`
        )
        .join('\n') +
      `\nassert(mp.commandv("loadfile", ${JSON.stringify(source.replaceAll('\\', '/'))}))\n`
    let input = source
    const ready = path.join(cache, `${name}.ready.json`)
    if (kind === 'subtitles' || kind === 'sdr-subtitles') {
      input = composition.inputFiles.steps.path
      assert.equal(digest(input), composition.inputFiles.steps.sha256)
      assert.equal(digest(composition.subtitles.path), composition.subtitles.sha256)
      fs.writeFileSync(ready, '{}')
      text =
        `assert(mp.set_property("tone-mapping", ${JSON.stringify(tone)}))\n` +
        subtitleTemplate.scriptSource
          .replaceAll('both-low-peak', name)
          .replace('"target-prim", "bt.2020"', `"target-prim", ${JSON.stringify(primaries)}`)
          .replace('"target-trc", "linear"', `"target-trc", ${JSON.stringify(transfer)}`)
          .replace('"target-peak", "100"', `"target-peak", ${JSON.stringify(String(peak))}`)
          .replace(
            'blendSubtitles = mp.get_property("blend-subtitles")',
            'blendSubtitles = mp.get_property("blend-subtitles"), ' +
              'sourcePrimaries = mp.get_property("video-params/primaries"), ' +
              'sourceTransfer = mp.get_property("video-params/gamma")'
          )
      if (kind === 'sdr-subtitles') {
        const previousInput = JSON.stringify(input.replaceAll('\\', '/'))
        assert.equal(text.split(previousInput).length, 2)
        input = sdrSource
        text = text.replace(previousInput, JSON.stringify(input.replaceAll('\\', '/')))
      }
    }
    fs.writeFileSync(script, text)
    const frames = await produceFrames(binary.dll, '', input, script, true, true, 'scrgb')
    const samples = []
    let observations
    try {
      if (kind === 'subtitles' || kind === 'sdr-subtitles') {
        observations = JSON.parse(fs.readFileSync(ready))
        assert(observations.ready && observations.subtitleSelected && observations.osdConfigured)
        assert.equal(observations.targetTrc, transfer)
        assert.equal(observations.targetPrim, primaries)
        if (kind === 'sdr-subtitles') {
          assert.equal(observations.sourcePrimaries, 'bt.709')
          assert.equal(typeof observations.sourceTransfer, 'string')
          assert(!['pq', 'hlg'].includes(observations.sourceTransfer))
        }
      }
      for (const [index, frame] of frames.entries()) {
        const info = frame.info()
        assert.equal(info.pixelFormat, 'rgba16float')
        const bytes = frame.pixels()
        let nonFinite = 0,
          maximumFinite = 0,
          nonOpaque = 0
        for (let i = 0; i < bytes.length / 2; i++) {
          const value = half(bytes.readUInt16LE(i * 2))
          if (i % 4 === 3) nonOpaque += Number(value !== 1)
          else if (!Number.isFinite(value)) nonFinite++
          else maximumFinite = Math.max(maximumFinite, Math.abs(value))
        }
        const file = path.join(cache, `${name}-${index}.rgba16f`)
        fs.writeFileSync(file, bytes)
        samples.push({
          width: info.width,
          height: info.height,
          nonFinite,
          maximumFinite,
          nonOpaque,
          raw: { path: file, sha256: digest(file) }
        })
      }
    } finally {
      for (const frame of frames) frame.release()
    }
    cases.push({
      kind,
      primaries,
      transfer,
      peakNits: peak,
      toneMapping: tone,
      options,
      observations,
      scriptSource: text,
      samples
    })
  }
  const result = {
    checkedAt: new Date().toISOString(),
    compositionReceiptSha256: digest(compositionPath),
    source: { path: source, sha256: digest(source) },
    sdrSource: { path: sdrSource, sha256: digest(sdrSource), arguments: sdrArguments },
    generator: { path: ffmpeg, sha256: digest(ffmpeg), arguments },
    scriptSha256: digest(__filename),
    dllSha256: digest(binary.dll),
    addonSha256: digest(addon),
    displaySettingsChanged: false,
    ownShaderUsed: false,
    cases
  }
  fs.writeFileSync(
    path.join(__dirname, 'black-contract.json'),
    JSON.stringify(result, null, 2) + '\n'
  )
  console.log(
    JSON.stringify(
      cases.map((item) => ({
        kind: item.kind,
        primaries: item.primaries,
        transfer: item.transfer,
        peakNits: item.peakNits,
        toneMapping: item.toneMapping,
        samples: item.samples.map(({ raw, ...sample }) => sample)
      }))
    )
  )
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
