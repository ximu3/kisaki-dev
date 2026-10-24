const { app, BrowserWindow, ipcMain, sharedTexture } = require('electron')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')

const [addonPath, dll, angle, media, script, output, userData] = process.argv.slice(2)
app.setPath('userData', userData)
app.commandLine.appendSwitch('use-angle', 'd3d11')
const deadline = setTimeout(() => app.exit(2), 25000)
const pending = new Map()
const releases = new Map()
const frames = []
let window

function message(key) {
  const value = Promise.withResolvers()
  pending.set(key, value)
  return value.promise
}
ipcMain.on('probe-result', (event, result) => {
  if (!window || event.sender !== window.webContents) return
  const receiver = pending.get(result.key)
  if (!receiver) throw new Error('Unexpected probe message.')
  pending.delete(result.key)
  if (result.failure)
    receiver.reject(new Error('Renderer probe failed.', { cause: result.failure }))
  else receiver.resolve(result.value)
})

app
  .whenReady()
  .then(async () => {
    const ready = message('ready')
    window = new BrowserWindow({
      show: false,
      width: 160,
      height: 120,
      webPreferences: {
        preload: path.join(__dirname, 'electron-preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false
      }
    })
    await window.loadFile(path.join(__dirname, 'electron.html'))
    await ready
    const { produceFrames } = require(addonPath)
    frames.push(...(await produceFrames(dll, '', media, script, true, true)))
    frames.push(...(await produceFrames(dll, angle, media, script, true, false)))
    frames.push(...(await produceFrames(dll, '', media, script, true, true, 'pq')))
    const imports = []
    for (const [index, frame] of frames.entries()) {
      const info = frame.info()
      assert(info.coreDestroyed && info.rendererBeforeInitialize && info.startupScript)
      const released = Promise.withResolvers()
      const state = { count: 0, released }
      releases.set(index, state)
      const imported = sharedTexture.importSharedTexture({
        textureInfo: {
          pixelFormat: info.pixelFormat === 'rgba16float' ? 'rgbaf16' : 'bgra',
          codedSize: { width: info.width, height: info.height },
          colorSpace:
            info.target === 'pq'
              ? { primaries: 'bt2020', transfer: 'pq', matrix: 'rgb', range: 'full' }
              : { primaries: 'bt709', transfer: 'srgb', matrix: 'rgb', range: 'full' },
          timestamp: 0,
          handle: { ntHandle: frame.handle() }
        },
        allReferencesReleased() {
          state.count++
          frame.release()
          released.resolve()
        }
      })
      const received = message(`received-${index}`)
      await sharedTexture.sendSharedTexture(
        {
          frame: window.webContents.mainFrame,
          importedSharedTexture: imported
        },
        index,
        info.target
      )
      const observed = await received
      imported.release()
      assert.equal(state.count, 0)
      const firstClosed = message(`first-closed-${index}`)
      window.webContents.send('probe-close-first', index)
      await firstClosed
      assert.equal(state.count, 0)
      const lastClosed = message(`last-closed-${index}`)
      window.webContents.send('probe-close-last', index)
      await lastClosed
      await released.promise
      assert.equal(state.count, 1)
      assert.throws(() => frame.pixels())
      imports.push({
        backend: info.backend,
        target: info.target,
        pixelFormat: info.pixelFormat,
        width: info.width,
        height: info.height,
        adapterLuid: info.adapterLuid,
        producerVendor: info.vendor,
        producerDevice: info.device,
        ...observed,
        releaseWaitedForLastClone: true,
        allReferencesReleased: state.count
      })
    }
    const gpu = await app.getGPUInfo('complete')
    const result = {
      electron: process.versions.electron,
      node: process.versions.node,
      nodeApi: process.versions.napi,
      imports,
      gpuDevices: gpu.gpuDevice?.map(({ vendorId, deviceId, active }) => ({
        vendorId,
        deviceId,
        active
      })),
      featureStatus: app.getGPUFeatureStatus(),
      nativeGpuExecuted: true,
      electronImportExecuted: true,
      directD3d11RenderApiExecuted: true,
      sandboxedRenderer: true,
      visibleWindowCreated: false,
      independentAnglePackagingVerified: false,
      hardwareDecodingExecuted: false,
      hdrTargetImportExecuted: true,
      physicalHdrDisplayVerified: false
    }
    fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`)
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
