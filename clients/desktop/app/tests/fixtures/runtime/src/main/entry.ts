/** @fileoverview Test-only Electron carrier for compiler, resource, process and packaging checks. */

import { app, BrowserWindow, ipcMain, protocol, utilityProcess } from 'electron'
import { mkdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadNative } from '#native'

const argument = (name: string) =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3)
const profile = argument('profile')
if (!profile || !isAbsolute(profile)) {
  throw new Error('The engineering fixture requires an explicit isolated profile')
}
const kind = argument('window') ?? 'main'
if (!['main', 'reader', 'player', 'game-panel'].includes(kind)) {
  throw new Error('Unknown fixture entry')
}
const runtime = app.isPackaged
  ? app.getAppPath()
  : resolve(dirname(fileURLToPath(import.meta.url)), '..')
const resources = app.isPackaged
  ? join(process.resourcesPath, 'resources')
  : join(runtime, 'resources')
const browser = join(profile, 'browser')
mkdirSync(browser, { recursive: true })
app.setPath('userData', profile)
app.setPath('sessionData', browser)
app.setName('Kisaki engineering fixture')
protocol.registerSchemesAsPrivileged([
  { scheme: 'fixture', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

/** Start the runtime after module evaluation so Electron can emit ready normally. */
async function runFixture(): Promise<void> {
  await app.whenReady()
  loadNative(join(resources, 'native/kisaki-native.node'))
  protocol.handle('fixture', async (request) => {
    const path = resolve(
      runtime,
      'renderer',
      `.${decodeURIComponent(new URL(request.url).pathname)}`,
    )
    const name = relative(join(runtime, 'renderer'), path)
    if (name.startsWith('..') || isAbsolute(name)) {
      return new Response(null, { status: 403 })
    }
    const types: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.woff2': 'font/woff2',
    }
    return new Response(await readFile(path), {
      headers: { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' },
    })
  })

  const worker = utilityProcess.fork(join(runtime, 'extension-host/entry.js'), [], {
    serviceName: 'Engineering fixture worker',
  })
  const workerClosed = new Promise<void>((resolveClosed) =>
    worker.once('exit', () => resolveClosed()),
  )
  await new Promise<void>((resolveReady, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Fixture worker readiness timed out')),
      10_000,
    )
    worker.once('message', () => {
      clearTimeout(timeout)
      resolveReady()
    })
    worker.once('exit', () => {
      clearTimeout(timeout)
      reject(new Error('Fixture worker exited before readiness'))
    })
  })

  const window = new BrowserWindow({
    width: 720,
    height: 480,
    show: false,
    webPreferences: {
      preload: join(runtime, `preload/${kind}.cjs`),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  ipcMain.handle('fixture:identity', () => ({
    kind,
    buildId: __KISAKI_BUILD_ID__,
    workerPid: worker.pid,
  }))
  let canQuit = false
  /** Exercise normal cancellable window close without defining a product shutdown contract. */
  function closeWindow(): void {
    if (!window.isDestroyed()) {
      window.close()
    }
  }
  window.on('close', (event) => {
    queueMicrotask(() => {
      if (event.defaultPrevented) {
        process.send?.({ type: 'fixture-cancelled' })
      }
    })
  })
  app.on('before-quit', (event) => {
    if (!canQuit) {
      event.preventDefault()
      closeWindow()
    }
  })
  window.once('closed', () => {
    worker.kill()
    void workerClosed.then(() => {
      canQuit = true
      app.quit()
    })
  })
  process.on('message', (message) => {
    if (
      message &&
      typeof message === 'object' &&
      'type' in message &&
      message.type === 'fixture-stop'
    ) {
      closeWindow()
    }
  })
  process.once('disconnect', closeWindow)
  const rendererUrl = argument('renderer-url')
  await window.loadURL(
    rendererUrl
      ? new URL(`${kind}/index.html`, rendererUrl).href
      : `fixture://runtime/${kind}/index.html`,
  )
  window.show()
  process.send?.({ type: 'fixture-ready', buildId: __KISAKI_BUILD_ID__ })
}

void runFixture().catch((cause: unknown) => {
  console.error(cause)
  app.exit(1)
})
