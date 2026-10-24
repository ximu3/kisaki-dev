// Private package-layout fixture; it does not implement the public Mpv interface.
const assert = require('node:assert/strict')
const path = require('node:path')
const ownPackage = require('./package.json')

exports.runFixture = async function runFixture() {
  assert.equal(process.platform, 'win32')
  assert.equal(process.arch, 'x64')
  assert(Number(process.versions.napi) >= 8)
  const platform = require('@libmpv-design/loader-probe-win32-x64')
  assert.equal(platform.version, ownPackage.version)
  assert.equal(platform.manifest.scope, 'private research package, not a release candidate')
  const native = path.join(platform.root, 'native')
  const addonPath = path.join(native, 'libmpv-gpu-probe.node')
  const addon = require(addonPath)
  const observed = new Set()
  const names = new Set(
    platform.manifest.files.map((file) => path.basename(file.path).toLowerCase())
  )
  function sampleModules() {
    for (const file of process.report.getReport().sharedObjects) {
      if (names.has(path.basename(file).toLowerCase())) observed.add(file)
    }
  }
  sampleModules()
  const timer = setInterval(sampleModules, 20)
  let frames = []
  try {
    frames = await addon.produceFrames(
      path.join(native, 'libmpv-2.dll'),
      '',
      path.join(platform.root, 'fixture.ppm'),
      '',
      true,
      true,
      'srgb'
    )
    sampleModules()
    const pictures = frames.map((frame) => {
      const info = frame.info()
      assert(info.coreDestroyed && info.backend === 'd3d11')
      const pixels = frame.pixels()
      const points = [
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75]
      ]
      const samples = points.map(([x, y]) => {
        const offset = (Math.floor(y * info.height) * info.width + Math.floor(x * info.width)) * 4
        return [...pixels.subarray(offset, offset + 4)]
      })
      assert.deepEqual(samples, [
        [0, 0, 255, 255],
        [0, 255, 0, 255],
        [255, 0, 0, 255],
        [255, 255, 255, 255]
      ])
      return { width: info.width, height: info.height, samples, coreDestroyed: info.coreDestroyed }
    })
    assert.deepEqual(
      pictures.map(({ width, height }) => [width, height]),
      [
        [63, 47],
        [31, 23]
      ]
    )
    return {
      main: __filename,
      platform: platform.root,
      addon: addonPath,
      observedModules: [...observed].sort(),
      pictures
    }
  } finally {
    clearInterval(timer)
    for (const frame of frames) frame.release()
  }
}
