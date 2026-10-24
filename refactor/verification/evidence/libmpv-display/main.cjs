const { app, BrowserWindow, ipcMain, sharedTexture, screen } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')

const [addon, dll, sdrSample, hdrSample, output, userData, captureExecutable] =
  process.argv.slice(2)
const visible = true
app.setPath('userData', userData)
app.on('window-all-closed', () => {})
const deadline = setTimeout(() => app.exit(2), 25000)
const pending = new Map()
const held = []
const releases = []
let window
function message(key) {
  const result = Promise.withResolvers()
  pending.set(key, result)
  return result.promise
}
ipcMain.on('display-probe', (event, reply) => {
  if (event.sender !== window?.webContents) return
  if (reply.key === 'stage') console.info(reply.value)
  const receiver = pending.get(reply.key)
  if (!receiver) return
  pending.delete(reply.key)
  if (reply.failure) receiver.reject(new Error(reply.failure))
  else receiver.resolve(reply.value)
})
ipcMain.handle('capture-display', async (event, points) => {
  assert.equal(event.sender, window.webContents)
  assert(points.length > 0 && points.length <= 16)
  assert(
    points.every(
      (point) =>
        point.length === 2 &&
        point.every((value) => Number.isFinite(value) && value >= 0 && value < 1)
    )
  )
  const hwnd = window.getNativeWindowHandle().readBigUInt64LE().toString()
  const result = await promisify(execFile)(
    captureExecutable,
    [hwnd, ...points.flat().map(String)],
    {
      windowsHide: true,
      timeout: 8000
    }
  )
  return JSON.parse(result.stdout)
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
      width: 320,
      height: 240,
      frame: false,
      title: 'Kisaki display probe',
      backgroundColor: '#202020',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false
      }
    })
    if (visible) window.showInactive()
    await window.loadFile(path.join(__dirname, '../libmpv-playback/renderer.html'))
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
      releases.push({ promise: released.promise, count: () => releaseCount })
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
      console.info(`Reference ${index} consumed.`)
      imported.release()
      cases.push({
        input: index === 0 ? 'sdr-reference' : 'pq-1000-nit-reference',
        nativePixel,
        ...result,
        releasedWhenReceiverFinished: releaseCount
      })
    }
    await Promise.all(releases.map((entry) => entry.promise))
    for (const [index, entry] of releases.entries()) {
      assert.equal(entry.count(), 1)
      cases[index].releaseCount = entry.count()
    }
    window.destroy()
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
          allReferencesReleasedBeforeWindowClose: true,
          visibleWindowCreated: visible,
          physicalHdrDisplayVerified: false
        },
        null,
        2
      ) + '\n'
    )
    clearTimeout(deadline)
    app.quit()
  })
  .catch((error) => {
    console.error(error)
    clearTimeout(deadline)
    window?.destroy()
    for (const frame of held) frame.release()
    app.exit(1)
  })
