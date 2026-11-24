import { app, BrowserWindow } from 'electron'

async function start(): Promise<void> {
  await app.whenReady()
  const window = new BrowserWindow({
    show: false,
    width: 1000,
    height: 800,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  })
  await window.loadURL(app.commandLine.getSwitchValue('ui-consumer-url'))
}

app.on('window-all-closed', () => app.quit())

// Let module evaluation finish before Electron readiness resolves the startup operation.
start().catch((error: unknown) => {
  console.error(error)
  app.exit(1)
})
