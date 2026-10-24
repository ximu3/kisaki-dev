const { app, BrowserWindow, ipcMain, sharedTexture, screen } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')

const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
app.setPath('userData', input.userData)
app.on('window-all-closed', () => {})
const deadline = setTimeout(() => app.exit(2), 45000)
const pending = new Map()
const held = []
const releases = []
let window
function message(key) {
  const result = Promise.withResolvers()
  pending.set(key, result)
  return result.promise
}
ipcMain.on('mapping-probe', (event, reply) => {
  if (event.sender !== window?.webContents) return
  const receiver = pending.get(reply.key)
  if (!receiver) return
  pending.delete(reply.key)
  if (reply.failure) receiver.reject(new Error(reply.failure))
  else receiver.resolve(reply.value)
})
ipcMain.handle('capture-mapping', async (event, points) => {
  assert.equal(event.sender, window.webContents)
  assert.equal(points.length, 8)
  assert(
    points.every(
      (point) =>
        point.length === 2 &&
        point.every((value) => Number.isFinite(value) && value >= 0 && value < 1)
    )
  )
  const hwnd = window.getNativeWindowHandle().readBigUInt64LE().toString()
  const result = await promisify(execFile)(input.capture, [hwnd, ...points.flat().map(String)], {
    windowsHide: true,
    timeout: 8000
  })
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
      frame: false,
      width: 320,
      height: 144,
      title: 'Kisaki tone mapping probe',
      backgroundColor: '#202020',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false
      }
    })
    window.showInactive()
    await window.loadFile(path.join(__dirname, '../libmpv-playback/renderer.html'))
    await ready
    const capabilities = await window.webContents.executeJavaScript(`new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve({
      visibility: document.visibilityState,
      dynamicRangeHigh: matchMedia('(dynamic-range: high)').matches
    })))
  })`)
    const display = screen.getDisplayMatching(window.getBounds())
    const { produceFrames } = require(input.addon)
    const cases = []
    for (const [index, setup] of input.cases.entries()) {
      const frames = await produceFrames(
        input.dll,
        '',
        setup.source,
        setup.script,
        true,
        true,
        setup.nativeMode
      )
      const frame = frames[0]
      frames[1].release()
      held.push(frame)
      const info = frame.info()
      assert(info.coreDestroyed)
      assert.equal(info.pixelFormat, 'rgba16float')
      const bytes = frame.pixels()
      const nativeSamples = Array.from({ length: 7 }, (_, index) => {
        const x = Math.floor((info.width * (index + 0.5)) / 7)
        const y = Math.floor(info.height * 0.5)
        return [0, 1, 2, 3].map((channel) =>
          half(bytes.readUInt16LE((y * info.width + x) * 8 + channel * 2))
        )
      })
      const released = Promise.withResolvers()
      let releaseCount = 0
      releases.push({ promise: released.promise, count: () => releaseCount })
      const imported = sharedTexture.importSharedTexture({
        textureInfo: {
          pixelFormat: 'rgbaf16',
          codedSize: { width: info.width, height: info.height },
          colorSpace: setup.colorSpace,
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
      cases.push({
        name: setup.name,
        referenceKind: setup.referenceKind,
        peakNits: setup.peakNits,
        nativeSamples,
        ...result
      })
    }
    await Promise.all(releases.map((entry) => entry.promise))
    for (const [index, entry] of releases.entries()) {
      assert.equal(entry.count(), 1)
      cases[index].releaseCount = entry.count()
    }
    window.destroy()
    fs.writeFileSync(
      input.output,
      JSON.stringify(
        {
          electron: process.versions.electron,
          chromium: process.versions.chrome,
          capabilities,
          display: { id: display.id, label: display.label, colorSpace: display.colorSpace },
          cases,
          allReferencesReleasedBeforeWindowClose: true,
          physicalHdrDisplayVerified: false,
          completeColorPipelineVerified: false
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
