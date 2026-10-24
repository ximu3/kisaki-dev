const fs = require('node:fs')
const path = require('node:path')
const { app, BrowserWindow } = require('electron')
const profile = path.join(__dirname, 'virtual-profile')
fs.mkdirSync(profile, { recursive: true })
app.setPath('userData', profile)
app.setPath('sessionData', profile)
app.commandLine.appendSwitch('enable-precise-memory-info')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    width: 1000,
    height: 800,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      offscreen: true
    }
  })
  try {
    await window.loadFile(path.join(__dirname, 'candidates/out/index.html'))
    const deadline = Date.now() + 30000
    let value
    do {
      value = await window.webContents.executeJavaScript('window.probeState')
      if (value && value.status !== 'running') break
      await new Promise((resolve) => setTimeout(resolve, 100))
    } while (Date.now() < deadline)
    fs.writeFileSync(
      path.join(__dirname, 'virtual-results.json'),
      JSON.stringify(
        { versions: process.versions, result: value ?? { status: 'timeout' } },
        null,
        2
      )
    )
    window.destroy()
    app.exit(value?.status === 'passed' ? 0 : 1)
  } catch (error) {
    fs.writeFileSync(
      path.join(__dirname, 'virtual-error.json'),
      JSON.stringify({ message: error.message, stack: error.stack }, null, 2)
    )
    window.destroy()
    app.exit(1)
  }
})
