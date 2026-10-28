/**
 * @fileoverview Owns native window creation, renderer readiness and the sender-bound close
 * capability.
 */

import { BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import type { WindowKind } from '../../../shared/window-controls'

interface NativeWindowOptions {
  runtime: string
  title: string
  kind: WindowKind
  /** Vite loopback origin; undefined selects the compiled renderer. */
  rendererUrl: string | undefined
}

function windowUrl(kind: WindowKind, rendererUrl?: string): string {
  if (!rendererUrl) return `kisaki-app://native/${kind}/index.html`

  const base = new URL(rendererUrl)
  if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1') {
    throw new Error('Development renderer must use its owned loopback server')
  }

  return new URL(`${kind}/index.html`, base).href
}

/** Resolve after the main frame mounts; reject on window closure or a 30-second startup timeout. */
function waitForRenderer(window: BrowserWindow): Promise<void> {
  return new Promise((resolveReady, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Window renderer did not become ready'))
    }, 30_000)

    const onReady = (event: Electron.IpcMainEvent) => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame
      ) {
        return
      }

      cleanup()
      resolveReady()
    }

    const onClosed = () => {
      cleanup()
      reject(new Error('Window closed before renderer readiness'))
    }

    /** Release the readiness subscriptions on either completion or failure. */
    function cleanup(): void {
      clearTimeout(timeout)
      ipcMain.off('window:ready', onReady)
      window.off('closed', onClosed)
    }

    ipcMain.on('window:ready', onReady)
    window.once('closed', onClosed)
  })
}

/** Open a native window and return after mounting and display; destroy it if loading fails. */
export async function createNativeWindow(options: NativeWindowOptions): Promise<BrowserWindow> {
  const { runtime, kind, rendererUrl } = options
  const url = windowUrl(kind, rendererUrl)
  const window = new BrowserWindow({
    title: options.title,
    width: 1120,
    height: 760,
    minWidth: 480,
    minHeight: 320,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(runtime, 'preload', `${kind}.cjs`),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  })

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, destination) => {
    if (destination !== window.webContents.getURL()) event.preventDefault()
  })

  ipcMain.handle('window:close', (event) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
      throw new Error('Window control is not available to this sender')
    }

    window.close()
  })
  window.once('closed', () => ipcMain.removeHandler('window:close'))

  try {
    // Loading HTML and mounting the renderer are separate readiness conditions.
    await Promise.all([waitForRenderer(window), window.loadURL(url)])

    window.show()
    return window
  } catch (cause) {
    if (!window.isDestroyed()) window.destroy()

    throw cause
  }
}
