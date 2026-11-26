import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { app, BrowserWindow, session } from 'electron'
import type { NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import type { ApplicationExitApi } from '@kisaki3/desktop-contracts/app'
import type { WindowKind } from '../../../shared/window-api/protocol'
import { releaseAll } from '../../infrastructure/release'
import { windowGeometry } from '../../infrastructure/windows/geometry'
import { serveDocument } from '../../infrastructure/windows/document'
import type { Application } from '../compose'
import { openWindowDocument } from './document'

const baseTitlebarHeight = 31.5

interface WindowHost {
  close(): void
  restart(this: void): void
  ready(navigate: (target: NativeViewTarget) => Promise<void>): Promise<void>
  disconnected(): void
  unavailable(error: Error): void
}

export async function createWindow(
  application: Application,
  kind: WindowKind,
  devUrl: string | undefined,
  lifecycle: ApplicationExitApi,
  host: WindowHost,
) {
  const { paths, resources } = application
  const windowSession = session.fromPartition('kisaki-window-' + randomUUID())
  const detach = await application.network.attach(windowSession, devUrl)
  const view = resources.view(windowSession)
  windowSession.protocol.handle(
    'kisaki-app',
    serveDocument(paths.runtime, paths.resources, view.origin, devUrl && new URL(devUrl).origin),
  )
  const documentUrl = devUrl
    ? new URL(kind + '/index.html', devUrl).href
    : 'kisaki-app://window/' + kind + '/index.html'
  const geometry = await windowGeometry(paths.data, kind)
  const controlsOverlay = kind === 'main' && process.platform !== 'darwin'
  const titlebarHeight = () =>
    Math.round((baseTitlebarHeight * application.saved.appearance.interfaceScale) / 100)
  let overlayHeight = titlebarHeight()

  if (devUrl) {
    const hmr = 'ws://' + new URL(devUrl).host
    const policy = [
      "default-src 'none'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' kisaki-app://window 'unsafe-inline'",
      "font-src 'self' kisaki-app://window " + view.origin,
      "img-src 'self' kisaki-app://window " + view.origin,
      "connect-src 'self' " + hmr,
      "worker-src 'self' blob:",
      "frame-src 'none'",
    ].join('; ')
    windowSession.webRequest.onHeadersReceived({ urls: [documentUrl] }, (details, reply) =>
      reply({
        responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [policy] },
      }),
    )
  }

  const window = new BrowserWindow({
    ...geometry.options,
    show: false,
    title: app.name,
    ...(kind === 'main' && {
      ...(controlsOverlay && { titleBarOverlay: { height: overlayHeight } }),
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
      autoHideMenuBar: true,
    }),
    icon: join(paths.resources, 'icons', 'icon.png'),
    webPreferences: {
      preload: join(paths.runtime, 'preload', kind + '.cjs'),
      session: windowSession,
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  })
  const contents = window.webContents
  if (devUrl) {
    contents.on('console-message', (event) => {
      if (event.level === 'error') {
        console.error('Source document:', event.message)
      }
    })
  }
  geometry.restore(window)

  const firstReady = Promise.withResolvers<'ready' | 'closed'>()
  let started = false
  let failed = false
  let startupTimer: NodeJS.Timeout | undefined
  let document: ReturnType<typeof openWindowDocument> | undefined
  let documentCleanup = Promise.resolve()

  let destroying = false
  let disposal: Promise<void> | undefined
  let accepting = true
  const pendingCalls = new Set<Promise<unknown>>()

  function trackCall(call: Promise<unknown>) {
    pendingCalls.add(call)
    void call.then(
      () => pendingCalls.delete(call),
      () => pendingCalls.delete(call),
    )
  }

  function show() {
    if (window.isMinimized()) {
      window.restore()
    }
    window.show()
    window.focus()
  }

  windowSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  windowSession.setPermissionCheckHandler(() => false)
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-navigate', (event, url) => {
    if (url !== documentUrl) {
      event.preventDefault()
    }
  })
  function disconnectDocument() {
    host.disconnected()
    if (!document) {
      return
    }

    const previous = documentCleanup
    document.rpc.close()
    const releasing = document.dispose()
    document = undefined

    // Revoke the old document immediately, then let native window disposal await all cleanups.
    void releasing.catch(() => {})
    documentCleanup = releaseAll([() => previous, () => releasing])
    void documentCleanup.catch(console.error)
  }

  function failWindow(cause: unknown) {
    if (destroying || failed) {
      return
    }
    failed = true
    clearTimeout(startupTimer)
    disconnectDocument()
    if (started) {
      host.unavailable(cause instanceof Error ? cause : new Error(String(cause)))
    } else {
      firstReady.reject(cause)
    }
  }

  function waitForDocument() {
    clearTimeout(startupTimer)
    startupTimer = setTimeout(
      () => failWindow(new Error(application.i18n.t('runtime.windowStartupTimeout'))),
      devUrl ? 90_000 : 30_000,
    )
  }

  const failLoading = (cause: unknown) => {
    // A development document can recover through HMR after the app has started.
    if (!devUrl || !started) {
      failWindow(cause)
    }
  }
  contents.on('did-start-navigation', ({ isMainFrame, isSameDocument }) => {
    if (isMainFrame && !isSameDocument) {
      disconnectDocument()
      if (started && !devUrl && !failed && !destroying) {
        waitForDocument()
      }
    }
  })
  contents.on('did-finish-load', () => void application.log.record('document-loaded'))
  contents.on('did-fail-load', (_event, code, reason, url, mainFrame) => {
    // A navigation withdrawn in favor of another document reports ERR_ABORTED.
    if (mainFrame && url === documentUrl && code !== -3) {
      failLoading(new Error(application.i18n.t('runtime.windowDocumentFailed', { reason })))
    }
  })
  contents.on('preload-error', (_event, _path, error) => failLoading(error))
  contents.ipc.on('kisaki-entry-failed', (event) => {
    if (
      !devUrl &&
      event.senderFrame === contents.mainFrame &&
      event.senderFrame.url === documentUrl
    ) {
      failWindow(new Error(application.i18n.t('runtime.windowEntryFailed')))
    }
  })
  contents.on('render-process-gone', (_event, details) => {
    failWindow(new Error(application.i18n.t('runtime.windowExited', { reason: details.reason })))
  })
  window.on('close', (event) => {
    if (!destroying) {
      event.preventDefault()
      host.close()
    }
  })
  window.once('closed', () => {
    failWindow(new Error(application.i18n.t('runtime.windowClosedUnexpectedly')))
  })

  contents.ipc.on('kisaki-connect', (event, requestedKind: unknown) => {
    if (
      failed ||
      destroying ||
      event.senderFrame !== contents.mainFrame ||
      event.senderFrame.url !== documentUrl ||
      requestedKind !== kind ||
      document
    ) {
      return
    }
    const endpoint = openWindowDocument({
      application,
      kind,
      window,
      view,
      lifecycle,
      controlsOverlay,
      titlebarHeight,
      show,
      restart: host.restart,
      isAccepting: () => accepting,
      trackCall,
      onNavigationReady: (navigate) => host.ready(navigate),
      onReady: () => {
        if (document === endpoint) {
          clearTimeout(startupTimer)
          started = true
          firstReady.resolve('ready')
        }
      },
      onStartupError: (cause) => {
        if (document === endpoint) {
          failLoading(cause)
        }
      },
    })
    document = endpoint
    void endpoint.rpc.closed.then(() => {
      if (document === endpoint) {
        disconnectDocument()
      }
    })
    event.senderFrame.postMessage('kisaki-port', null, [endpoint.port])
  })

  async function destroy() {
    destroying = true
    clearTimeout(startupTimer)
    firstReady.resolve('closed')
    await releaseAll([
      () => overlaySettings?.dispose(),
      async () => {
        if (!window.isDestroyed()) {
          await geometry.save(window).catch(console.error)
        }
      },
      disconnectDocument,
      () => {
        if (!window.isDestroyed()) {
          window.destroy()
        }
      },
      () => Promise.allSettled([...pendingCalls]),
      () => documentCleanup,
      () => view.dispose(),
      () => windowSession.protocol.unhandle('kisaki-app'),
      () => {
        if (devUrl) {
          windowSession.webRequest.onHeadersReceived(null)
        }
      },
      () => windowSession.setPermissionRequestHandler(null),
      () => windowSession.setPermissionCheckHandler(null),
      detach,
    ])
  }
  function dispose() {
    return (disposal ??= destroy())
  }

  const overlaySettings = controlsOverlay
    ? application.onUpdated(() => {
        const height = titlebarHeight()
        if (height !== overlayHeight) {
          window.setTitleBarOverlay({ height })
          overlayHeight = height
        }
      })
    : undefined

  void application.log.record('document-loading')
  waitForDocument()
  void window.loadURL(documentUrl)
  return {
    window,
    dispose,
    show,
    firstReady: firstReady.promise,
    setAccepting(enabled: boolean) {
      accepting = enabled
    },
    async drain() {
      await Promise.allSettled([...pendingCalls])
    },
    async canClose(signal: AbortSignal) {
      if (!document) {
        return true
      }
      return (await document.rpc.request('window.confirmClose', [], { signal })) === true
    },
  }
}
