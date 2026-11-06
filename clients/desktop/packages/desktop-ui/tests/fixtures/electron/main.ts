/** @fileoverview Isolated Electron document consumer of the already-built browser fixture. */

import { app, BrowserWindow } from 'electron'

/** Finish loading the entry module before waiting for Electron readiness. */
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
start().catch((error: unknown) => {
  console.error(error)
  app.exit(1)
})
