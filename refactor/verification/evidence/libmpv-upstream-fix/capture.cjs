// Compare complete libmpv builds through the unchanged native GPU probe.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')

const root = path.resolve(__dirname, '../../../..')
const evidence = path.join(root, 'refactor/verification/evidence')
const buildRoot = path.join(root, 'node_modules/.cache/libmpv-design/engine-build')
const variant = process.argv[2]
assert(['baseline', 'patched'].includes(variant))
const caseName = process.argv[3]
const cache = path.join(buildRoot, 'captures', variant)
fs.mkdirSync(cache, { recursive: true })
const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const reference = read(path.join(evidence, 'libmpv-composition/native-contract.json'))
const black = read(path.join(evidence, 'libmpv-composition/black-contract.json'))
const native = read(path.join(evidence, 'libmpv-gpu/native-contract.json'))
const addon = path.join(root, 'node_modules/.cache/libmpv-design/gpu-target/libmpv-gpu-probe.node')
const dll = path.join(buildRoot, 'runtime', variant, 'libmpv-2.dll')
assert.equal(digest(addon), native.addonSha256)
for (const file of ['producer.cpp', 'binding.rs']) {
  assert.equal(digest(path.join(evidence, 'libmpv-gpu', file)), native.sources[file])
}
for (const input of [
  ...Object.values(reference.inputFiles),
  reference.subtitles,
  reference.negativeControlShader,
  black.source,
  black.sdrSource
]) {
  assert.equal(digest(input.path), input.sha256)
}
const { produceFrames } = require(addon)
const luaPath = (file) => file.replaceAll('\\', '/')

const tiles = []
for (const [row, alpha] of [0, 64, 128, 255].entries()) {
  for (const [column, level] of [0, 1, 8, 255].entries()) {
    tiles.push({ x: 3 + column * 15, y: 3 + row * 11, width: 10, height: 6, alpha, level })
  }
}
const edges = path.join(buildRoot, 'edges.ass')
const header = reference.subtitles.source.split('Dialogue:')[0]
fs.writeFileSync(
  edges,
  header +
    tiles
      .map(({ x, y, width, height, alpha, level }) => {
        const color = level.toString(16).padStart(2, '0').repeat(3)
        const opacity = alpha.toString(16).padStart(2, '0')
        return (
          'Dialogue: 0,0:00:00.00,0:01:00.00,Default,,0,0,0,,' +
          `{\\an7\\pos(${x},${y})\\bord0\\shad0\\1c&H${color}&\\1a&H${opacity}&\\p1}` +
          `m 0 0 l ${width} 0 l ${width} ${height} l 0 ${height}\n`
        )
      })
      .join('')
)

const cases = black.cases.map((item, index) => ({
  name: `diagnostic-${index}`,
  group: 'previous-diagnostic',
  referenceIndex: index,
  source:
    item.kind === 'black'
      ? black.source.path
      : item.kind === 'sdr-subtitles'
        ? black.sdrSource.path
        : reference.inputFiles.steps.path,
  subtitle: item.kind !== 'black' ? reference.subtitles.path : null,
  osd: item.kind !== 'black',
  transfer: item.transfer,
  primaries: item.primaries,
  peakNits: item.peakNits,
  toneMapping: item.toneMapping
}))
cases.push(
  ...reference.cases.map((item) => ({
    name: `composition-${item.name}`,
    group: 'previous-composition',
    source: reference.inputFiles[item.kind].path,
    subtitle: item.subtitle ? reference.subtitles.path : null,
    osd: item.osd,
    hook: item.hook ? reference.negativeControlShader.path : null,
    transfer: 'linear',
    primaries: item.primaries,
    peakNits: item.peakNits,
    toneMapping: 'auto'
  }))
)
for (const primaries of ['bt.709', 'display-p3', 'bt.2020']) {
  for (const peakNits of [100, 203, 418]) {
    for (const subtitle of [null, edges]) {
      cases.push({
        name: `edges-${primaries}-${peakNits}-${subtitle ? 'subtitles' : 'base'}`,
        group: 'edge-colors',
        source: black.sdrSource.path,
        subtitle,
        osd: false,
        transfer: 'linear',
        primaries,
        peakNits,
        toneMapping: 'auto'
      })
    }
  }
}

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
  if (!caseName) {
    let result
    const allCases = []
    for (const setup of cases) {
      const execution = await promisify(execFile)(
        process.execPath,
        [__filename, variant, setup.name],
        {
          windowsHide: true,
          timeout: 20000
        }
      )
      assert.equal(execution.stderr, '')
      const current = read(path.join(cache, `${setup.name}.result.json`))
      assert.equal(current.captureSha256, digest(__filename))
      assert.equal(current.cases.length, 1)
      assert.equal(current.cases[0].name, setup.name)
      result = current
      allCases.push(current.cases[0])
    }
    result.checkedAt = new Date().toISOString()
    result.cases = allCases
    fs.writeFileSync(
      path.join(__dirname, `${variant}-contract.json`),
      JSON.stringify(result, null, 2) + '\n'
    )
    console.log(
      JSON.stringify({
        variant,
        cases: allCases.length,
        frames: allCases.reduce((sum, item) => sum + item.samples.length, 0),
        casesWithNonFinite: allCases
          .filter((item) => item.samples.some((sample) => sample.nonFinite))
          .map((item) => ({
            name: item.name,
            counts: item.samples.map((sample) => sample.nonFinite)
          }))
      })
    )
    return
  }
  const selected = cases.filter((setup) => setup.name === caseName)
  assert.equal(selected.length, 1)
  const results = []
  for (const setup of selected) {
    const script = path.join(cache, `${setup.name}.lua`)
    const ready = path.join(cache, `${setup.name}.ready.json`)
    fs.writeFileSync(ready, '{}')
    const options = [
      ['target-prim', setup.primaries],
      ['target-trc', setup.transfer],
      ['target-peak', String(setup.peakNits)],
      ['hdr-compute-peak', 'no'],
      ['gamut-mapping-mode', 'clip'],
      ['tone-mapping', setup.toneMapping],
      ['background', 'color'],
      ['background-color', '#000000'],
      ['video-aspect-override', '4:3'],
      ['sub-visibility', 'yes'],
      ['gpu-shader-cache', 'no']
    ]
    if (setup.hook) options.push(['glsl-shaders', luaPath(setup.hook)])
    const scriptSource =
      [
        'local utils = require("mp.utils")',
        ...options.map(
          ([key, value]) =>
            `assert(mp.set_property(${JSON.stringify(key)}, ${JSON.stringify(value)}))`
        ),
        'local overlay = nil',
        ...(setup.osd
          ? [
              'overlay = mp.create_osd_overlay("ass-events")',
              'overlay.res_x = 63; overlay.res_y = 47; overlay.z = 100',
              `overlay.data = ${JSON.stringify(reference.overlayData)}`,
              'overlay:update()'
            ]
          : []),
        'mp.register_event("file-loaded", function()',
        '  local selected = false',
        '  for _, track in ipairs(mp.get_property_native("track-list")) do',
        '    if track.type == "sub" and track.selected then selected = true end',
        '  end',
        `  assert(selected == ${Boolean(setup.subtitle)})`,
        `  local file = assert(io.open(${JSON.stringify(luaPath(ready))}, "w"))`,
        '  file:write(utils.format_json({ ready = true, subtitleSelected = selected, osdConfigured = overlay ~= nil,',
        '    targetTrc = mp.get_property("target-trc"), targetPrim = mp.get_property("target-prim"),',
        '    targetPeak = mp.get_property_native("target-peak"), toneMapping = mp.get_property("tone-mapping"),',
        '    shaderCache = mp.get_property_native("gpu-shader-cache"),',
        '    blendSubtitles = mp.get_property("blend-subtitles"),',
        '    sourcePrimaries = mp.get_property("video-params/primaries"),',
        '    sourceTransfer = mp.get_property("video-params/gamma"),',
        '    mpvVersion = mp.get_property("mpv-version"), ffmpegVersion = mp.get_property("ffmpeg-version") }))',
        '  file:close()',
        'end)',
        'local file_options = { ["sub-auto"] = "no" }',
        ...(setup.subtitle
          ? [`file_options["sub-file"] = ${JSON.stringify(luaPath(setup.subtitle))}`]
          : []),
        `assert(mp.command_native({"loadfile", ${JSON.stringify(luaPath(setup.source))}, "replace", -1, file_options}))`
      ].join('\n') + '\n'
    fs.writeFileSync(script, scriptSource)
    // Both floating modes allocate RGBA16F; Lua sets and verifies the actual output transfer.
    const frames = await produceFrames(dll, '', setup.source, script, true, true, 'pq')
    let observations
    const samples = []
    try {
      observations = read(ready)
      assert(observations.ready)
      assert.equal(observations.subtitleSelected, Boolean(setup.subtitle))
      assert.equal(observations.osdConfigured, setup.osd)
      assert.equal(observations.targetTrc, setup.transfer)
      assert.equal(observations.targetPrim, setup.primaries)
      assert.equal(observations.targetPeak, setup.peakNits)
      assert.equal(observations.toneMapping, setup.toneMapping)
      assert.equal(observations.shaderCache, false)
      assert.equal(observations.blendSubtitles, 'no')
      for (const [index, frame] of frames.entries()) {
        const info = frame.info()
        assert(info.coreDestroyed)
        assert.equal(info.backend, 'd3d11')
        assert.equal(info.pixelFormat, 'rgba16float')
        const bytes = frame.pixels()
        assert.equal(bytes.length, info.width * info.height * 8)
        let nonFinite = 0
        let nonOpaque = 0
        for (let offset = 0; offset < bytes.length; offset += 2) {
          const value = half(bytes.readUInt16LE(offset))
          if (offset % 8 === 6) nonOpaque += Number(value !== 1)
          else nonFinite += Number(!Number.isFinite(value))
        }
        const file = path.join(cache, `${setup.name}-${index}.rgba16f`)
        fs.writeFileSync(file, bytes)
        samples.push({
          width: info.width,
          height: info.height,
          device: { vendor: info.vendor, device: info.device, adapterLuid: info.adapterLuid },
          nonFinite,
          nonOpaque,
          raw: { path: file, sha256: digest(file) }
        })
      }
    } finally {
      for (const frame of frames) frame.release()
    }
    assert.deepEqual(
      samples.map(({ width, height }) => [width, height]),
      [
        [63, 47],
        [31, 23]
      ]
    )
    results.push({
      ...setup,
      options,
      observations,
      scriptSource,
      scriptSha256: digest(script),
      samples
    })
  }
  const result = {
    checkedAt: new Date().toISOString(),
    variant,
    node: process.version,
    probeFloatingAllocationMode: 'pq',
    captureIsolation: 'one-native-library-load-per-node-process',
    dll: { path: dll, sha256: digest(dll) },
    addon: { path: addon, sha256: digest(addon) },
    captureSha256: digest(__filename),
    references: Object.fromEntries(
      [
        'libmpv-composition/native-contract.json',
        'libmpv-composition/black-contract.json',
        'libmpv-gpu/native-contract.json'
      ].map((name) => [name, digest(path.join(evidence, name))])
    ),
    inputs: Object.fromEntries(
      [...new Set(cases.map((item) => item.source))].map((file) => [file, digest(file)])
    ),
    edges: { path: edges, sha256: digest(edges), source: fs.readFileSync(edges, 'utf8'), tiles },
    allReturnedFramesReleased: true,
    displaySettingsChanged: false,
    hardwareDecodeEnabled: false,
    hostPresentationVerified: false,
    cases: results
  }
  fs.writeFileSync(
    path.join(cache, `${caseName}.result.json`),
    JSON.stringify(result, null, 2) + '\n'
  )
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
