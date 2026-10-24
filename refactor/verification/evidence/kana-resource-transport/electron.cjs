// Hidden, isolated Electron mechanism probe; no application profile or repository code is loaded.
const { app, BrowserWindow, protocol } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { prepare } = require('./fixture.cjs')
const root = path.resolve(__dirname, '../../../..')
const cache = path.join(root, 'node_modules/.cache/kana-resource-transport')
app.setPath('userData', path.join(cache, 'electron-profile'))
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'kana-probe',
    privileges: { standard: true, secure: true, supportFetchAPI: true, allowServiceWorkers: true }
  }
])
let window
const deadline = setTimeout(() => app.exit(2), 90000)
app.whenReady().then(async () => {
  let record
  try {
    const fixture = await prepare()
    protocol.handle('kana-probe', (request) => {
      const url = new URL(request.url)
      if (url.host !== 'app') return new Response(null, { status: 403 })
      const item = fixture.responseFor(url)
      return new Response(item.body, {
        status: item.status,
        headers: { 'Content-Type': item.type, 'Cache-Control': 'no-store' }
      })
    })
    window = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
    })
    await window.loadURL('kana-probe://app/host.html')
    const result = await window.webContents.executeJavaScript(
      `probe.runCases(${JSON.stringify(fixture.data)})`
    )
    const cleanup = await window.webContents.executeJavaScript('probe.finishTransport()')
    record = { version: process.versions, result, cleanup, nativeRequests: fixture.requests }
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
