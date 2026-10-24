const { app, BrowserWindow, ipcMain, sharedTexture } = require('electron')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { runScenario } = require('./scenario.cjs')

const [addon, dll, red, blue, missing, output, userData] = process.argv.slice(2)
app.setPath('userData', userData)
app.commandLine.appendSwitch('use-angle', 'd3d11')
const deadline = setTimeout(() => app.exit(2), 45000)
const pending = new Map()
let window
let transport

function message(key) {
  assert(!pending.has(key))
  const result = Promise.withResolvers()
  pending.set(key, result)
  return result.promise
}
ipcMain.on('handoff-result', (event, packet) => {
  if (!window || event.sender !== window.webContents) return
  if (packet.key === 'entered') {
    transport.delayedEntered = true
    transport.notify?.()
    return
  }
  const result = pending.get(packet.key)
  if (!result) return
  pending.delete(packet.key)
  packet.failure
    ? result.reject(new Error('Handoff renderer failed.', { cause: packet.failure }))
    : result.resolve(packet.value)
})

function createTransport(run) {
  let sequence = 0
  let delayNext = false
  const imports = []
  return {
    delayedEntered: false,
    async begin(token) {
      const done = message(`epoch-${run}-${token}`)
      window.webContents.send('handoff-epoch', { run, token })
      await done
    },
    delayNext() {
      delayNext = true
    },
    async deliver(frame, token, color, release) {
      const id = `${run}-${++sequence}`
      const delayed = delayNext
      delayNext = false
      const released = Promise.withResolvers()
      const state = { id, count: 0, released, imported: undefined, ownReleased: false }
      imports.push(state)
      state.imported = sharedTexture.importSharedTexture({
        textureInfo: {
          pixelFormat: 'bgra',
          codedSize: { width: 64, height: 48 },
          colorSpace: { primaries: 'bt709', transfer: 'srgb', matrix: 'rgb', range: 'full' },
          // This monotonic probe timestamp is not a media PTS or a presentation receipt.
          timestamp: sequence * 1000,
          handle: { ntHandle: frame.handle() }
        },
        allReferencesReleased() {
          state.count++
          release(frame)
          released.resolve()
        }
      })
      const received = message(`received-${id}`)
      await sharedTexture.sendSharedTexture(
        { frame: window.webContents.mainFrame, importedSharedTexture: state.imported },
        { id, run, token, delayed }
      )
      const result = await received
      state.imported.release()
      state.ownReleased = true
      if (result.retained) assert.equal(state.count, 0)
      else {
        await released.promise
        assert.equal(state.count, 1)
      }
      return result
    },
    async closeHeld() {
      const done = message(`held-${run}`)
      window.webContents.send('handoff-close-held', run)
      const result = await done
      await Promise.all(imports.map((state) => state.released.promise))
      for (const state of imports) assert.equal(state.count, 1)
      return {
        ...result,
        afterCoreClose: true,
        imports: imports.length,
        allReferencesReleased: imports.map(({ id, count }) => ({ id, count }))
      }
    },
    async dispose() {
      if (!imports.some((state) => state.count === 0)) return
      const done = message(`dispose-${run}`)
      window.webContents.send('handoff-dispose', run)
      await done
      for (const state of imports) {
        if (!state.ownReleased) {
          state.imported.release()
          state.ownReleased = true
        }
      }
      await Promise.all(imports.map((state) => state.released.promise))
    }
  }
}

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
    const cases = []
    for (const [index, renderFirst] of [false, true].entries()) {
      transport = createTransport(index + 1)
      cases.push(await runScenario({ addon, dll, red, blue, missing, renderFirst, transport }))
    }
    const gpu = await app.getGPUInfo('complete')
    fs.writeFileSync(
      output,
      `${JSON.stringify(
        {
          electron: process.versions.electron,
          node: process.versions.node,
          cases,
          visibleWindowCreated: false,
          sandboxedRenderer: true,
          gpuDevices: gpu.gpuDevice?.map(({ vendorId, deviceId, active }) => ({
            vendorId,
            deviceId,
            active
          })),
          hardwareDecodingExecuted: false,
          physicalPresentationVerified: false,
          hdrDisplayVerified: false,
          systemDisplaySettingsChanged: false
        },
        null,
        2
      )}\n`
    )
    clearTimeout(deadline)
    window.destroy()
    app.quit()
  })
  .catch((error) => {
    console.error(error)
    clearTimeout(deadline)
    if (window && !window.isDestroyed()) window.destroy()
    app.exit(1)
  })
