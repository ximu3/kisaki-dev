const { app, BrowserWindow, ipcMain, sharedTexture, screen } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')

const [addon, dll, sdrSample, hdrSample, output, userData] = process.argv.slice(2)
const visible = process.env.KISAKI_HDR_PROBE_SHOW === '1'
app.setPath('userData', userData)
const deadline = setTimeout(() => app.exit(2), 25000)
const pending = new Map()
const held = []
let window
function message(key) {
  const result = Promise.withResolvers()
  pending.set(key, result)
  return result.promise
}
ipcMain.on('display-probe', (event, reply) => {
  if (event.sender !== window?.webContents) return
  const receiver = pending.get(reply.key)
  if (!receiver) return
  pending.delete(reply.key)
  if (reply.failure) receiver.reject(new Error(reply.failure))
  else receiver.resolve(reply.value)
})

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

app
  .whenReady()
  .then(async () => {
    const ready = message('ready')
    window = new BrowserWindow({
      show: false,
      width: 160,
      height: 120,
      title: 'Kisaki HDR probe',
      backgroundColor: '#202020',
      webPreferences: {
        preload: path.join(__dirname, 'renderer-preload.cjs'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false
      }
    })
    if (visible) window.showInactive()
    await window.loadFile(path.join(__dirname, 'renderer.html'))
    const capabilities = await ready
    if (visible) {
      Object.assign(
        capabilities,
        await window.webContents.executeJavaScript(`new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve({
        visibility: document.visibilityState,
        dynamicRangeHigh: matchMedia('(dynamic-range: high)').matches,
        videoDynamicRangeHigh: matchMedia('(video-dynamic-range: high)').matches
      })))
    })`)
      )
    }
    const display = screen.getDisplayMatching(window.getBounds())
    const { produceFrames } = require(addon)
    const cases = []
    for (const [index, source] of [sdrSample, hdrSample].entries()) {
      const frames = await produceFrames(dll, '', source, '', true, true, 'pq')
      const frame = frames[0]
      frames[1].release()
      held.push(frame)
      const info = frame.info()
      const bytes = frame.pixels()
      const offset =
        (Math.floor(info.height * 0.75) * info.width + Math.floor(info.width * 0.75)) * 8
      const nativePixel = [0, 1, 2, 3].map((channel) =>
        half(bytes.readUInt16LE(offset + channel * 2))
      )
      const released = Promise.withResolvers()
      let releaseCount = 0
      const imported = sharedTexture.importSharedTexture({
        textureInfo: {
          pixelFormat: 'rgbaf16',
          codedSize: { width: info.width, height: info.height },
          colorSpace: { primaries: 'bt2020', transfer: 'pq', matrix: 'rgb', range: 'full' },
          timestamp: index * 41667,
          handle: { ntHandle: frame.handle() }
        },
        allReferencesReleased() {
          releaseCount++
          frame.release()
          released.resolve()
        }
      })
      const received = message(`frame-${index}`)
      await sharedTexture.sendSharedTexture(
        { frame: window.webContents.mainFrame, importedSharedTexture: imported },
        index
      )
      const result = await received
      imported.release()
      await released.promise
      assert.equal(releaseCount, 1)
      cases.push({
        input: index === 0 ? 'sdr-reference' : 'pq-1000-nit-reference',
        nativePixel,
        ...result,
        releaseCount
      })
    }
    fs.writeFileSync(
      output,
      JSON.stringify(
        {
          electron: process.versions.electron,
          chromium: process.versions.chrome,
          capabilities,
          display: {
            id: display.id,
            label: display.label,
            bounds: display.bounds,
            colorSpace: display.colorSpace
          },
          forcedColorProfile: app.commandLine.getSwitchValue('force-color-profile'),
          primaryDisplayId: screen.getPrimaryDisplay().id,
          displays: screen
            .getAllDisplays()
            .map((value) => ({ id: value.id, label: value.label, bounds: value.bounds })),
          cases,
          gpuFeatureStatus: app.getGPUFeatureStatus(),
          nativeD3d11ImportExecuted: true,
          visibleWindowCreated: visible,
          physicalHdrDisplayVerified: false
        },
        null,
        2
      ) + '\n'
    )
    clearTimeout(deadline)
    window.destroy()
    app.quit()
  })
  .catch((error) => {
    console.error(error)
    clearTimeout(deadline)
    window?.destroy()
    for (const frame of held) frame.release()
    app.exit(1)
  })
