// Run one native scene per process; the existing probe's module lifetime stays unchanged.
const { app, BrowserWindow, ipcMain, sharedTexture } = require('electron')
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict')
const inputs = JSON.parse(fs.readFileSync(path.join(__dirname, 'source-input.json'), 'utf8'))
const setup = inputs.cases.find((value) => value.name === process.argv[2])
app.setPath('userData', setup.userData)
app.commandLine.appendSwitch('use-angle', 'd3d11')
const pending = new Map(),
  frames = []
let window
const deadline = setTimeout(() => app.exit(2), 30000)
function message(key) {
  const result = Promise.withResolvers()
  pending.set(key, result)
  return result.promise
}
ipcMain.on('result', (event, value) => {
  if (!window || event.sender !== window.webContents) return
  const result = pending.get(value.key)
  assert(result)
  pending.delete(value.key)
  if (value.error) result.reject(new Error(value.error))
  else result.resolve(value.value)
})
function samples(frame, points) {
  const info = frame.info(),
    bytes = frame.pixels()
  return points.map(([x, y]) => {
    const offset = (Math.floor(y * info.height) * info.width + Math.floor(x * info.width)) * 4
    return [bytes[offset + 2], bytes[offset + 1], bytes[offset], bytes[offset + 3]]
  })
}
app
  .whenReady()
  .then(async () => {
    const ready = message('ready')
    window = new BrowserWindow({
      show: false,
      width: 200,
      height: 130,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false
      }
    })
    await window.loadURL('data:text/html,<!doctype html><title>SDR integration proof</title>')
    await ready
    const { produceFrames } = require(inputs.addon)
    frames.push(
      ...(await produceFrames(inputs.dll.path, '', setup.media, setup.script, true, true, 'srgb'))
    )
    const observed = JSON.parse(fs.readFileSync(setup.metadata, 'utf8'))
    assert.equal(observed.transfer, 'srgb')
    assert.equal(observed.primaries, setup.target === 'display-p3' ? 'display-p3' : 'bt.709')
    const imported = []
    async function consume(frame, index, primaries) {
      const info = frame.info()
      assert(info.coreDestroyed && info.backend === 'd3d11' && info.pixelFormat === 'bgra8unorm')
      const release = Promise.withResolvers()
      let releaseCount = 0
      const texture = sharedTexture.importSharedTexture({
        textureInfo: {
          pixelFormat: 'bgra',
          codedSize: { width: info.width, height: info.height },
          colorSpace: { primaries, transfer: 'srgb', matrix: 'rgb', range: 'full' },
          timestamp: 0,
          handle: { ntHandle: frame.handle() }
        },
        allReferencesReleased() {
          releaseCount++
          release.resolve()
        }
      })
      const received = message('received-' + index)
      await sharedTexture.sendSharedTexture(
        { frame: window.webContents.mainFrame, importedSharedTexture: texture },
        index,
        setup.points
      )
      const result = await received
      texture.release()
      assert.equal(releaseCount, 0)
      const first = message('first-' + index)
      window.webContents.send('close-first', index)
      await first
      assert.equal(releaseCount, 0)
      const last = message('last-' + index)
      window.webContents.send('close-last', index)
      await last
      await release.promise
      assert.equal(releaseCount, 1)
      return result
    }
    for (const [index, frame] of frames.entries()) {
      const info = frame.info(),
        native = samples(frame, setup.points)
      const result = await consume(frame, index, setup.target === 'display-p3' ? 'p3' : 'bt709')
      imported.push({ width: info.width, height: info.height, native, ...result })
    }
    const wrongTag =
      setup.target === 'display-p3' ? await consume(frames[0], 'wrong-tag', 'bt709') : null
    for (const frame of frames) frame.release()
    const gpu = await app.getGPUInfo('basic')
    const result = {
      electron: process.versions.electron,
      node: process.versions.node,
      platform: process.platform,
      architecture: process.arch,
      gpuDevices: (gpu.gpuDevice || []).map(({ vendorId, deviceId, active }) => ({
        vendorId,
        deviceId,
        active
      })),
      featureStatus: app.getGPUFeatureStatus(),
      observed,
      imported,
      wrongTag,
      allImportsReleased: true,
      completeMpvImplementation: false,
      nativeSettingsAppliedByOwnedFixture: true,
      visibleWindowCreated: false,
      physicalDisplayVerified: false,
      macosExecuted: false,
      linuxExecuted: false,
      screenshotSubtitlesExecuted: false
    }
    fs.writeFileSync(setup.output, JSON.stringify(result, null, 2) + '\n')
    clearTimeout(deadline)
    window.destroy()
    app.quit()
  })
  .catch((error) => {
    console.error(error)
    clearTimeout(deadline)
    for (const frame of frames) frame.release()
    if (window && !window.isDestroyed()) window.destroy()
    app.exit(1)
  })
