import { app, BrowserWindow } from 'electron'
import { isAbsolute, join } from 'node:path'

const profile = process.env.PROBE_PROFILE
if (!profile || !isAbsolute(profile)) throw new Error('An isolated probe profile is required')
app.setPath('userData', profile)
app.setPath('sessionData', join(profile, 'browser'))
app.on('window-all-closed', () => app.quit())
process.on('message', (message: unknown) => {
  if (message && typeof message === 'object' && 'type' in message && message.type === 'stop') {
    app.quit()
  }
})
process.once('disconnect', () => app.quit())

// Module evaluation must finish before Electron can emit ready.
void app
  .whenReady()
  .then(async () => {
    const window = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    })
    await window.loadURL('data:text/html,<html><body>AppImage policy probe</body></html>')
    const view: unknown = await window.webContents.executeJavaScript(
      '({ text: document.body.textContent, node: typeof require, process: typeof process })',
    )
    process.send?.({
      type: 'ready',
      pid: process.pid,
      uid: process.getuid?.(),
      rendererPid: window.webContents.getOSProcessId(),
      argv: process.argv,
      version: app.getVersion(),
      isPackaged: app.isPackaged,
      view,
    })
  })
  .catch((cause: unknown) => {
    console.error(cause)
    app.exit(1)
  })
