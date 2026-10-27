import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import type { DevelopmentStopResult } from '@kisaki3/desktop-contracts/development'
import type { ExtensionHostProcess } from './extension-host'
import { logFailure, logLifecycle } from '../infrastructure/log'

/** Close the host only after windows accept quit, reporting cancellation without releasing readers. */
export function registerShutdown(
  host: ExtensionHostProcess,
  report?: (result: DevelopmentStopResult) => Promise<void>,
): void {
  let stopping: Promise<void> | undefined

  /** Reporting failure must not prevent an already accepted application shutdown. */
  async function notify(result: DevelopmentStopResult): Promise<void> {
    try {
      await report?.(result)
    } catch (cause) {
      logFailure('app', cause)
    }
  }

  app.on('before-quit', (event) => {
    queueMicrotask(() => {
      if (event.defaultPrevented) void notify({ type: 'stopResult', outcome: 'cancelled' })
    })
  })

  /** Electron exposes cancellation at the window close and renderer beforeunload boundaries. */
  function observeWindow(window: BrowserWindow): void {
    window.on('close', (event) => {
      queueMicrotask(() => {
        if (event.defaultPrevented) void notify({ type: 'stopResult', outcome: 'cancelled' })
      })
    })
    window.webContents.on('will-prevent-unload', (event) => {
      queueMicrotask(() => {
        if (!event.defaultPrevented) void notify({ type: 'stopResult', outcome: 'cancelled' })
      })
    })
  }
  app.on('browser-window-created', (_event, window) => observeWindow(window))

  app.on('will-quit', (event) => {
    event.preventDefault()
    stopping ??= (async () => {
      try {
        await host.stop()
        logLifecycle('app', 'Shutdown complete')
        await notify({ type: 'stopResult', outcome: 'exiting' })
        // The normal quit sequence has already accepted every window close.
        app.exit(0)
      } catch (cause) {
        logFailure('app', cause)
        await notify({
          type: 'stopResult',
          outcome: 'failed',
          error: {
            code: 'app.shutdownFailed',
            message: 'Application shutdown failed',
          },
        })
        app.exit(1)
      }
    })()
  })
  app.on('window-all-closed', () => app.quit())
}
