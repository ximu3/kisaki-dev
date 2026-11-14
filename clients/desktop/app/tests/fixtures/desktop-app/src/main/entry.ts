/** @fileoverview Test-only Electron carrier for compiler, resource, process and packaging checks. */

import { app, BrowserWindow, ipcMain, protocol, utilityProcess } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { debuglog } from 'node:util'
import { loadNative } from '#native'
import { verifyStorage } from './storage'
import { Worker } from 'node:worker_threads'

/** Opt-in diagnostics for the fixture window and utility-process lifetime. */
const debug = debuglog('kisaki:fixture')

/** Reads a named --key=value argument from the fixture command line. */
const argument = (name: string) =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3)

/** Explicit isolated data directory supplied by the test or development-session owner. */
const profile = argument('profile')
if (!profile || !isAbsolute(profile)) {
  throw new Error('The engineering fixture requires an explicit isolated profile')
}

/** The requested fixture window entry, defaulting to the main window. */
const kind = argument('window') ?? 'main'
if (!['main', 'reader', 'player', 'game-panel'].includes(kind)) {
  throw new Error('Unknown fixture entry')
}

/** The current compiled runtime root in development or inside the packaged application. */
const runtime = app.isPackaged
  ? app.getAppPath()
  : resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** External runtime resources selected from the actual deployment layout. */
const resources = app.isPackaged
  ? join(process.resourcesPath, 'resources')
  : join(runtime, 'resources')

/** Browser state kept below the test-owned profile and separate from library data. */
const browser = join(profile, 'browser')
mkdirSync(browser, { recursive: true })
app.setPath('userData', profile)
app.setPath('sessionData', browser)
app.setName('Kisaki engineering fixture')

protocol.registerSchemesAsPrivileged([
  { scheme: 'fixture', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

/**
 * Starts the fixture's utility process and selected sandboxed window.
 *
 * After loading the renderer, shows the window and notifies a connected parent of the build
 * identity.
 */
async function runFixture(): Promise<void> {
  await app.whenReady()
  const native = loadNative(join(resources, 'native/kisaki-native.node'))
  await verifyStorage(profile!, resources, native.files)
  ipcMain.handle('fixture:ping', () => true)
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
    worker.once('exit', (code) => {
      debug('Utility process exited: %d', code)
      resolveClosed()
    }),
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
  let declineClose = process.argv.includes('--cancel-first-close')
  window.on('close', (event) => {
    // The fixture has no renderer-owned close work. Main either declines or commits teardown.
    event.preventDefault()
    if (declineClose) {
      declineClose = false
      const pids = app
        .getAppMetrics()
        .filter((metric) => metric.type === 'Utility')
        .map((metric) => metric.pid)
      writeFileSync(join(app.getPath('userData'), 'cancelled-hosts.json'), JSON.stringify(pids))
      process.send?.({ type: 'fixture-cancelled' })
    } else {
      window.destroy()
    }
  })

  ipcMain.handle('fixture:identity', () => ({
    kind,
    buildId: __KISAKI_BUILD_ID__,
    workerPid: worker.pid,
  }))

  let canQuit = false

  /** Requests a normal, cancellable close of the fixture window. */
  function closeWindow(): void {
    debug('Closing window: destroyed=%s', window.isDestroyed())
    if (!window.isDestroyed()) {
      window.close()
    }
  }

  app.on('before-quit', (event) => {
    debug('Application before-quit: canQuit=%s', canQuit)
    if (!canQuit) {
      event.preventDefault()
      closeWindow()
    }
  })

  window.once('closed', () => {
    const terminated = worker.kill()
    debug('Window closed; utility termination requested: %s', terminated)
    void workerClosed.then(() => {
      debug('Utility process closed; quitting application')
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
  const performanceWorker = argument('storage-performance')
  if (performanceWorker) {
    const measurement = new Worker(performanceWorker, { workerData: { profile, resources } })
    await new Promise<void>((resolve, reject) => {
      measurement.once('error', reject)
      measurement.once('exit', (code) =>
        code === 0 ? resolve() : reject(new Error('Storage worker exited with status ' + code)),
      )
    })
  }
}

// Leave module evaluation unblocked so Electron can reach app readiness.
void runFixture().catch((cause: unknown) => {
  console.error(cause)
  app.exit(1)
})
