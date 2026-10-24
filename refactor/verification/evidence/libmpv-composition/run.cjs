const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')

const root = path.resolve(__dirname, '../../../..')
const evidence = path.join(root, 'refactor/verification/evidence')
const cache = path.join(root, 'node_modules/.cache/libmpv-design/composition')
fs.mkdirSync(cache, { recursive: true })
const binary = JSON.parse(fs.readFileSync(path.join(evidence, 'libmpv-native/binary-input.json')))
const native = JSON.parse(fs.readFileSync(path.join(evidence, 'libmpv-gpu/native-contract.json')))
const fixtureReceipt = path.join(evidence, 'libmpv-tonemapping/hdr-contract.json')
const reference = JSON.parse(fs.readFileSync(fixtureReceipt))
const addon = path.join(root, 'node_modules/.cache/libmpv-design/gpu-target/libmpv-gpu-probe.node')
const helper = path.join(
  root,
  'node_modules/.cache/libmpv-design/composition-target/debug/libmpv-composition-probe.exe'
)
const sourceFiles = {
  steps: path.join(root, 'node_modules/.cache/libmpv-design/tonemapping/steps-pq-4000.mkv'),
  colors: path.join(root, 'node_modules/.cache/libmpv-design/tonemapping/colors-pq-4000.mkv')
}
const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const luaPath = (file) => file.replaceAll('\\', '/')
assert.equal(digest(binary.dll), binary.dllSha256)
assert.equal(digest(addon), native.addonSha256)
assert.equal(digest(sourceFiles.steps), reference.reference.sampleSha256)
assert.equal(digest(sourceFiles.colors), reference.reference.colorSampleSha256)
for (const name of ['producer.cpp', 'binding.rs']) {
  assert.equal(digest(path.join(evidence, 'libmpv-gpu', name)), native.sources[name])
}
const { produceFrames } = require(addon)

const subtitles = path.join(cache, 'composition.ass')
fs.writeFileSync(
  subtitles,
  `[Script Info]
ScriptType: v4.00+
PlayResX: 63
PlayResY: 47
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,18,&H00FFFFFF,&H000000FF,&H00000000,&H40000000,0,0,0,0,100,100,0,0,1,1,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:01:00.00,Default,,0,0,0,,{\\an7\\pos(3,33)\\bord0\\shad0\\1c&H00FF00&\\1a&H40&\\p1}m 0 0 l 18 0 l 18 8 l 0 8
Dialogue: 1,0:00:00.00,0:01:00.00,Default,,0,0,0,,{\\an7\\pos(23,26)\\bord1\\shad0\\1c&HFFFFFF&\\1a&H20&}A
`
)
const overlayData =
  '{\\an7\\pos(43,4)\\bord0\\shad0\\1c&H0000FF&\\1a&H40&\\p1}m 0 0 l 16 0 l 16 8 l 0 8'
const hook = path.join(cache, 'video-only.glsl')
fs.writeFileSync(
  hook,
  '//!HOOK OUTPUT\n//!BIND HOOKED\nvec4 hook() {\n' +
    '    vec4 value = HOOKED_tex(HOOKED_pos);\n' +
    '    return vec4(value.rgb * 0.5, value.a);\n}\n'
)

const setups = [
  { name: 'base', subtitle: false, osd: false },
  { name: 'subtitles', subtitle: true, osd: false },
  { name: 'osd', subtitle: false, osd: true },
  { name: 'both', subtitle: true, osd: true },
  { name: 'output-hook', subtitle: true, osd: true, hook: true },
  { name: 'both-low-peak', subtitle: true, osd: true, peakNits: 100 },
  { name: 'srgb-linear', subtitle: true, osd: true, primaries: 'bt.709', kind: 'colors' },
  { name: 'p3-linear', subtitle: true, osd: true, primaries: 'display-p3', kind: 'colors' }
].map((setup) => ({ peakNits: 418, primaries: 'bt.2020', kind: 'steps', ...setup }))

async function run() {
  const cases = []
  for (const setup of setups) {
    const source = sourceFiles[setup.kind]
    const script = path.join(cache, `${setup.name}.lua`)
    const ready = path.join(cache, `${setup.name}.ready.json`)
    fs.writeFileSync(ready, '{}')
    const options = [
      ['target-prim', setup.primaries],
      ['target-trc', 'linear'],
      ['target-peak', String(setup.peakNits)],
      ['hdr-compute-peak', 'no'],
      ['gamut-mapping-mode', 'clip'],
      ['background', 'color'],
      ['background-color', '#000000'],
      ['video-aspect-override', '4:3'],
      ['sub-visibility', 'yes']
    ]
    if (setup.hook) options.push(['glsl-shaders', luaPath(hook)])
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
              `overlay.data = ${JSON.stringify(overlayData)}`,
              'overlay:update()'
            ]
          : []),
        'mp.register_event("file-loaded", function()',
        '  local selected = false',
        '  for _, track in ipairs(mp.get_property_native("track-list")) do',
        '    if track.type == "sub" and track.selected then selected = true end',
        '  end',
        `  assert(selected == ${setup.subtitle})`,
        `  local file = assert(io.open(${JSON.stringify(luaPath(ready))}, "w"))`,
        '  file:write(utils.format_json({ ready = true, subtitleSelected = selected, osdConfigured = overlay ~= nil,',
        '    targetTrc = mp.get_property("target-trc"), targetPrim = mp.get_property("target-prim"),',
        '    blendSubtitles = mp.get_property("blend-subtitles") }))',
        '  file:close()',
        'end)',
        'local file_options = { ["sub-auto"] = "no" }',
        ...(setup.subtitle
          ? [`file_options["sub-file"] = ${JSON.stringify(luaPath(subtitles))}`]
          : []),
        `assert(mp.command_native({"loadfile", ${JSON.stringify(luaPath(source))}, "replace", -1, file_options}))`
      ].join('\n') + '\n'
    fs.writeFileSync(script, scriptSource)
    const frames = await produceFrames(binary.dll, '', source, script, true, true, 'scrgb')
    const observations = JSON.parse(fs.readFileSync(ready))
    const samples = []
    try {
      assert(observations.ready)
      assert.equal(observations.subtitleSelected, setup.subtitle)
      assert.equal(observations.osdConfigured, setup.osd)
      assert.equal(observations.targetTrc, 'linear')
      assert.equal(observations.targetPrim, setup.primaries)
      for (const [index, frame] of frames.entries()) {
        const info = frame.info()
        assert(info.coreDestroyed)
        assert.equal(info.backend, 'd3d11')
        assert.equal(info.pixelFormat, 'rgba16float')
        const pixels = frame.pixels()
        const raw = path.join(cache, `${setup.name}-${index}.rgba16f`)
        fs.writeFileSync(raw, pixels)
        const conversions = []
        if (!setup.hook) {
          for (const nitsPerUnit of [80, 240]) {
            const factor = Math.min(setup.peakNits, 203) / nitsPerUnit
            const prefix = path.join(cache, `${setup.name}-${index}-${nitsPerUnit}`)
            const execution = await promisify(execFile)(
              helper,
              [
                String(process.pid),
                frame.handle().readBigUInt64LE().toString(16),
                info.adapterLuid,
                String(factor),
                prefix
              ],
              { windowsHide: true, timeout: 8000 }
            )
            assert.equal(execution.stderr, '')
            const result = JSON.parse(execution.stdout)
            assert.equal(result.width, info.width)
            assert.equal(result.height, info.height)
            assert(result.gpuConverted)
            const input = prefix + '.input.rgba16f'
            const output = prefix + '.output.rgba16f'
            assert(fs.readFileSync(input).equals(pixels))
            conversions.push({
              nitsPerUnit,
              requestedFactor: factor,
              ...result,
              input: { path: input, sha256: digest(input) },
              output: { path: output, sha256: digest(output) }
            })
          }
        }
        samples.push({
          width: info.width,
          height: info.height,
          device: { vendor: info.vendor, device: info.device, adapterLuid: info.adapterLuid },
          raw: { path: raw, sha256: digest(raw) },
          conversions
        })
      }
    } finally {
      for (const frame of frames) frame.release()
    }
    cases.push({
      ...setup,
      nativeNitsPerUnit: Math.min(setup.peakNits, 203),
      observations,
      scriptSource,
      scriptSha256: digest(script),
      samples
    })
  }
  const result = {
    checkedAt: new Date().toISOString(),
    node: process.version,
    sources: Object.fromEntries(
      ['run.cjs', 'Cargo.toml', 'Cargo.lock', 'build.rs', 'main.rs', 'convert.cpp'].map((name) => [
        name,
        digest(path.join(__dirname, name))
      ])
    ),
    sharedSources: Object.fromEntries(
      ['producer.cpp', 'binding.rs'].map((name) => [
        `libmpv-gpu/${name}`,
        digest(path.join(evidence, 'libmpv-gpu', name))
      ])
    ),
    fixtureReceiptSha256: digest(fixtureReceipt),
    inputFiles: Object.fromEntries(
      Object.entries(sourceFiles).map(([kind, file]) => [
        kind,
        { path: file, sha256: digest(file) }
      ])
    ),
    subtitles: {
      path: subtitles,
      sha256: digest(subtitles),
      source: fs.readFileSync(subtitles, 'utf8')
    },
    overlayData,
    negativeControlShader: {
      path: hook,
      sha256: digest(hook),
      source: fs.readFileSync(hook, 'utf8')
    },
    dllSha256: digest(binary.dll),
    addonSha256: digest(addon),
    helperSha256: digest(helper),
    allReturnedFramesReleased: true,
    displaySettingsChanged: false,
    hardwareDecodeEnabled: false,
    hostDisplayVerified: false,
    productionOutputImplemented: false,
    cases
  }
  fs.writeFileSync(
    path.join(__dirname, 'native-contract.json'),
    JSON.stringify(result, null, 2) + '\n'
  )
  console.log(
    JSON.stringify({
      cases: cases.length,
      frames: cases.reduce((total, item) => total + item.samples.length, 0),
      conversions: cases.reduce(
        (total, item) =>
          total + item.samples.reduce((n, sample) => n + sample.conversions.length, 0),
        0
      ),
      allReturnedFramesReleased: true
    })
  )
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
