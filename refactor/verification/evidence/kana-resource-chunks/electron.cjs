// Run the same fixtures through an isolated, hidden Electron window and an in-memory session.
const { app, BrowserWindow, protocol, session } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { createFixture } = require('./fixture.cjs')
const root = path.resolve(__dirname, '../../../..')
const cache = path.join(root, 'node_modules/.cache/kana-resource-runtime')
app.setPath('userData', path.join(cache, 'electron-profile'))
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'kana-runtime',
    privileges: { standard: true, secure: true, supportFetchAPI: true, allowServiceWorkers: true }
  }
])
let window
const deadline = setTimeout(() => app.exit(2), 150000)
app.whenReady().then(async () => {
  let record
  const fixture = createFixture()
  try {
    const environment = session.fromPartition('kana-runtime-proof')
    environment.protocol.handle('kana-runtime', async (request) => {
      const url = new URL(request.url)
      if (url.host !== 'app') return new Response(null, { status: 403 })
      const item = fixture.response(url)
      if (item.delay) await new Promise((resolve) => setTimeout(resolve, item.delay))
      return new Response(item.body, { status: item.status, headers: item.headers })
    })
    window = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        session: environment
      }
    })
    await window.loadURL('kana-runtime://app/host.html')
    const platform = await window.webContents.executeJavaScript('runtimeProbe.portEvents()')
    const streams = await window.webContents.executeJavaScript('runStreamCases()')
    const deployment = await window.webContents.executeJavaScript('runDeploymentCases()')
    const storage = await window.webContents.executeJavaScript('runStorageCases()')
    await window.webContents.executeJavaScript('beginWorkerInterruption()')
    window.webContents.debugger.attach('1.3')
    let restart
    try {
      await window.webContents.debugger.sendCommand('ServiceWorker.enable')
      await window.webContents.debugger.sendCommand('ServiceWorker.stopAllWorkers')
      restart = await window.webContents.executeJavaScript('finishWorkerInterruption()')
    } finally {
      window.webContents.debugger.detach()
    }
    const cleanup = await window.webContents.executeJavaScript('runtimeProbe.finish()')
    record = {
      version: process.versions,
      platform,
      streams,
      deployment,
      storage,
      restart,
      cleanup,
      nativeRequests: fixture.requests
    }
  } catch (error) {
    record = { failed: true, error: String(error), stack: error.stack }
  } finally {
    fs.mkdirSync(cache, { recursive: true })
    fs.writeFileSync(path.join(cache, 'electron-result.json'), JSON.stringify(record, null, 2))
    window?.destroy()
    clearTimeout(deadline)
    app.quit()
  }
})
