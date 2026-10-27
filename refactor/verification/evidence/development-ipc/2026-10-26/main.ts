import { app } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const profile = process.env.KISAKI_IPC_PROBE_PROFILE!
mkdirSync(profile, { recursive: true })
app.setPath('userData', profile)
app.setPath('sessionData', profile)
app.setAppLogsPath(join(profile, 'logs'))

let refuseQuit = false
let stopId: number | undefined

// A synthetic refusal exercises Electron's actual cancellable quit event.
app.on('before-quit', (event) => {
  if (!refuseQuit) return
  refuseQuit = false
  event.preventDefault()
  process.send?.({ type: 'stopResult', id: stopId, outcome: 'cancelled' })
})

process.on('message', (message: { type: string; id?: number; value?: unknown }) => {
  if (message.type === 'echo') {
    process.send?.({ type: 'echoResult', id: message.id, value: message.value })
  } else if (message.type === 'cancelStop') {
    stopId = message.id
    refuseQuit = true
    app.quit()
  } else if (message.type === 'stop') {
    process.send?.({ type: 'stopResult', id: message.id, outcome: 'exiting' }, () => app.quit())
  }
})

process.on('disconnect', () => {
  writeFileSync(join(profile, 'disconnect.json'), JSON.stringify({ observed: true }))
  app.quit()
})

// Main-module evaluation must finish before Electron can emit ready.
void app.whenReady().then(() => {
  const runtime = {
    packaged: app.isPackaged,
    processType: process.type,
    connected: process.connected,
    sendType: typeof process.send,
    node: process.versions.node,
    electron: process.versions.electron,
    chromium: process.versions.chrome,
  }
  writeFileSync(join(profile, 'runtime.json'), JSON.stringify(runtime, null, 2))
  process.send?.({ type: 'ready', runtime })
})
