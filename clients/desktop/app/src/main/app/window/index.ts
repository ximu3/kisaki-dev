/** @fileoverview Binds native windows to verified documents, scoped resource URLs and explicitly selected RPC methods. */

import { releaseAll } from '../../infrastructure/release'
import type { MainWindowApi } from '../../../shared/window-api'
import { BrowserWindow, MessageChannelMain, session } from 'electron'
import { windowGeometry } from '../../infrastructure/windows/geometry'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { serveDocument } from '../../infrastructure/windows/document'
import type { NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import { toggle, textArgument } from './values'
import { runWindowCall } from './admission'
import { createFileMethods } from './files'
import { RpcConnection, RpcError, type RpcMethod } from '@kisaki3/desktop-rpc'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { parseListOptions } from '@kisaki3/desktop-contracts/operations'
import { parseTaskQuery, parseTaskRunRef } from '@kisaki3/desktop-contracts/tasks'
import { parsePreferencesUpdate } from '@kisaki3/desktop-contracts/preferences'
import {
  parseThemeRef,
  parseUserThemeCreate,
  parseUserThemeUpdate,
  parseAppearancePreviewInput,
  type AppearancePreview,
} from '@kisaki3/desktop-contracts/appearance'
import {
  rpcData,
  windowProtocol,
  windowErrors,
  type WindowKind,
} from '../../../shared/window-api/protocol'
import { parseDataModeChange, type ApplicationExitApi } from '@kisaki3/desktop-contracts/app'
import { environment, copyEnvironment } from '../../infrastructure/environment'
import type { Application } from '../compose'

/** Height of the main window's chrome in DIP at 100% interface scale. */
const baseTitlebarHeight = 31.5

/** Window actions owned by the application across document replacements. */
interface WindowHost {
  /** Applies the current close preference to the native window. */
  close(): void
  /** Requests a normal application restart and presents its outcome to the user. */
  restart(this: void): void
  /** Binds navigation to the receiver installed by this document. */
  ready(navigate: (target: NativeViewTarget) => Promise<void>): Promise<void>
  /** Withdraws the receiver when its document leaves. */
  disconnected(): void
}

/** Creates one native window with its document session and closes every old endpoint on navigation. */
export async function createWindow(
  application: Application,
  kind: WindowKind,
  devUrl: string | undefined,
  lifecycle: ApplicationExitApi,
  host: WindowHost,
) {
  const { paths, tasks, preferences, appearance, fonts, resources } = application
  const ses = session.fromPartition('kisaki-window-' + randomUUID())
  const detach = await application.network.attach(ses, devUrl)
  const view = resources.view(ses)
  ses.protocol.handle(
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
    ses.webRequest.onHeadersReceived({ urls: [documentUrl] }, (details, reply) =>
      reply({
        responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [policy] },
      }),
    )
  }

  const window = new BrowserWindow({
    ...geometry.options,
    show: false,
    title: 'Kisaki',
    ...(kind === 'main' && {
      ...(controlsOverlay && { titleBarOverlay: { height: overlayHeight } }),
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
      autoHideMenuBar: true,
    }),
    icon: join(paths.resources, 'icons', 'icon.png'),
    webPreferences: {
      preload: join(paths.runtime, 'preload', kind + '.cjs'),
      session: ses,
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
  const firstReady = Promise.withResolvers<void>()
  void firstReady.promise.catch(() => {})
  let connection: RpcConnection | undefined
  /** Releases the current document's subscriptions and held resources on replacement. */
  let closeDocument: () => Promise<void> = async () => {}
  let cleanup = Promise.resolve()
  let destroying = false
  let disposal: Promise<void> | undefined
  let accepting = true
  const pending = new Set<Promise<unknown>>()
  const { system } = application

  function show() {
    if (window.isMinimized()) {
      window.restore()
    }
    window.show()
    window.focus()
  }

  ses.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  ses.setPermissionCheckHandler(() => false)
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-navigate', (event, url) => {
    if (url !== documentUrl) {
      event.preventDefault()
    }
  })
  /** Releases the replaced document's RPC, subscriptions, preparations and independent bindings. */
  function reset() {
    host.disconnected()
    connection?.close()
    connection = undefined
    const dispose = closeDocument
    closeDocument = async () => {}
    const previous = cleanup
    const releasing = dispose()
    void releasing.catch(() => {})
    cleanup = releaseAll([() => previous, () => releasing])
    void cleanup.catch(console.error)
  }
  contents.on('did-start-navigation', (_event, _url, inPlace, mainFrame) => {
    if (mainFrame && !inPlace) {
      reset()
    }
  })
  contents.on('render-process-gone', () => {
    reset()
    firstReady.reject(new Error('The window document exited'))
  })
  window.on('close', (event) => {
    if (!destroying) {
      event.preventDefault()
      host.close()
    }
  })
  window.once('closed', () => {
    reset()
    firstReady.reject(new Error('The window was closed during startup'))
  })

  contents.ipc.on('kisaki-connect', (event, requestedKind: unknown) => {
    if (
      event.senderFrame !== contents.mainFrame ||
      event.senderFrame.url !== documentUrl ||
      requestedKind !== kind ||
      connection
    ) {
      return
    }
    const { port1, port2 } = new MessageChannelMain()
    const holds = new Map<
      string,
      {
        /** Ends a document-owned resource, including its asynchronous cleanup. */
        dispose(): void | Promise<void>
      }
    >()
    const previews = new Map<string, AppearancePreview>()
    let revoked = false
    /** Retains only resources owned by this document and releases late acquisitions after reload. */
    async function keep(
      hold: {
        /** Ends this individual document hold. */
        dispose(): void | Promise<void>
      },
      signal: AbortSignal,
    ) {
      if (revoked || signal.aborted) {
        await hold.dispose()
        signal.throwIfAborted()
        throw new DesktopError('ConnectionClosed', 'The window document ended')
      }
      const id = randomUUID()
      holds.set(id, hold)
      return id
    }
    /** Removes the lookup before awaiting release of the corresponding resource. */
    const release = async (id: string) => {
      const hold = holds.get(id)
      holds.delete(id)
      files?.forget(id)
      previews.delete(id)
      await hold?.dispose()
    }
    const files =
      kind === 'main'
        ? createFileMethods(application, window, view, keep, release, () => !revoked && accepting)
        : undefined
    const methods: Record<string, RpcMethod> = {
      /** Acknowledges that this document can receive navigation and close requests. */
      'window.ready': async () => {
        void application.log.record('window-ready')
        await host.ready(async (target) => {
          await rpc.request('window.navigate', [rpcData(target)])
          show()
        })
        if (!revoked) {
          firstReady.resolve()
        }
      },
      /** Reads the bound window identity, native state and effective language snapshot. */
      'window.state': () =>
        rpcData({
          startupDeadline: application.presentationDeadline,
          kind,
          platform: process.platform,
          buildId: __KISAKI_BUILD_ID__,
          titlebarHeight: kind === 'main' ? titlebarHeight() : null,
          locale: application.i18n.current.locale,
          messages: application.i18n.current.messages,
        }),
      /** Resolves the effective branch and acquires font URLs for this document. */
      'appearance.get': async (_, signal) => {
        const read = await appearance.forView(view, { signal })
        return rpcData({
          value: read.appearance,
          issues: read.issues,
          hold: await keep(read, signal),
        })
      },
      /** Reads the palette and scale available before document font loading finishes. */
      'appearance.base': async () => rpcData(await appearance.base()),
      /** Releases the identified hold in this document without affecting other readers. */
      'resources.release': async ([id]) => release(textArgument(id)),
    }
    if (kind === 'main') {
      Object.assign(methods, {
        /** Makes a pending editor decision reachable even when the window was in the tray. */
        'window.reveal': show,
        /** Applies the document's resolved colors to the native overlay. */
        'window.caption': ([color, symbolColor]) => {
          if (
            !controlsOverlay ||
            typeof color !== 'string' ||
            typeof symbolColor !== 'string' ||
            !/^#[0-9a-f]{8}$/.test(color) ||
            !/^#[0-9a-f]{8}$/.test(symbolColor)
          ) {
            throw new DesktopError('InvalidInput', 'Invalid window caption')
          }
          window.setTitleBarOverlay({
            color,
            ...(process.platform === 'win32' && { symbolColor }),
          })
        },
        /** Restarts the application after the normal close workflow succeeds. */
        'app.restart': () => {
          setImmediate(host.restart)
        },
        /** Cancels a pending exit while preserving work already completed. */
        'app.cancelExit': (_, signal) => lifecycle.cancel({ signal }),
        /** Reads the current close attempt and its progress. */
        'app.exitState': async (_, signal) => rpcData(await lifecycle.getState({ signal })),
        /** Reads saved preference fields and the opaque proxy credential revision. */
        'preferences.get': async (_, signal) => rpcData(await preferences.get({ signal })),
        /** Reads the complete default values for a reset draft. */
        'preferences.defaults': async (_, signal) =>
          rpcData(await preferences.getDefaults({ signal })),
        /** Reads labels and search destinations from the preference owner. */
        'preferences.fields': async (_, signal) =>
          rpcData(await preferences.listFields({ signal })),
        /** Validates the submitted fields and commits them against their baselines. */
        'preferences.update': async ([value], signal) =>
          rpcData(await preferences.update(parsePreferencesUpdate(value), { signal })),
        /** Lists built-in and registered translations by stable identity. */
        'translations.list': (_, signal) => rpcData(application.i18n.list({ signal })),
        /** Reads whether new requests can use the selected network route. */
        'network.state': async (_, signal) =>
          rpcData(await application.network.getState({ signal })),
        /** Reads one filtered interval of summaries and its total. */
        'tasks.list': async ([query, options], signal) =>
          rpcData(await tasks.list(parseTaskQuery(query), parseListOptions(options), { signal })),
        /** Reads a full task record, returning null when history is absent. */
        'tasks.get': async ([ref], signal) =>
          rpcData(await tasks.get(parseTaskRunRef(ref), { signal })),
        /** Reads only the distinct type values for the task filter. */
        'tasks.types': async () => rpcData(await tasks.types()),
        /** Waits for a terminal record independently of the underlying execution. */
        'tasks.wait': async ([ref], signal) =>
          rpcData(await tasks.wait(parseTaskRunRef(ref), { signal })),
        /** Acquires an ordered, lightweight task observation for this document. */
        'tasks.observe': async ([ref], signal) =>
          keep(
            await tasks.observe(
              parseTaskRunRef(ref),
              (state) => rpc.notify('tasks.state', rpcData(state)),
              { signal },
            ),
            signal,
          ),
        /** Requests a pause at the next business checkpoint. */
        'tasks.pause': async ([ref], signal) =>
          rpcData(await tasks.pause(parseTaskRunRef(ref), { signal })),
        /** Releases a reached pause or withdraws a pending one. */
        'tasks.resume': async ([ref], signal) =>
          rpcData(await tasks.resume(parseTaskRunRef(ref), { signal })),
        /** Requests cancellation and returns the acknowledged control state. */
        'tasks.cancel': async ([ref], signal) =>
          rpcData(await tasks.cancel(parseTaskRunRef(ref), { signal })),
        /** Clears all finished history independently of the task center's visible filters. */
        'tasks.clear': async (_, signal) => tasks.clearHistory({}, { signal }),
        /** Removes one ended record by run identity. */
        'tasks.delete': async ([ref], signal) =>
          tasks.deleteHistory(parseTaskRunRef(ref), { signal }),
        /** Lists available theme identities with names resolved for this window. */
        'themes.list': async (_, signal) =>
          rpcData(
            (await appearance.themes.list({ signal })).map((theme) => ({
              ref: theme.ref,
              name: appearance.themes.displayName(theme, application.i18n.current.locale),
            })),
          ),
        /** Reads a complete theme definition without acquiring font files. */
        'themes.get': async ([ref], signal) =>
          rpcData(await appearance.themes.get(parseThemeRef(ref), { signal })),
        /** Creates a user theme and adopts any required private font copies atomically. */
        'themes.clone': async ([ref, name], signal) =>
          rpcData(
            await appearance.themes.clone(
              parseThemeRef(ref),
              { name: textArgument(name) },
              { signal },
            ),
          ),
        /** Creates an independent user theme with both color branches. */
        'themes.create': async ([input], signal) =>
          rpcData(await appearance.themes.create(parseUserThemeCreate(input), { signal })),
        /** Compares the edited name and individual tokens before committing the theme. */
        'themes.update': async ([id, input], signal) =>
          appearance.themes.update(textArgument(id), parseUserThemeUpdate(input), { signal }),
        /** Removes a user theme while retaining its fonts and saved selection references. */
        'themes.delete': async ([id], signal) =>
          appearance.themes.delete(textArgument(id), { signal }),
        /** Acquires the application preview for this document after validating its branch. */
        'themes.preview': async ([request, input], signal) => {
          const owner = textArgument(request)
          const preview = await appearance.preview(parseAppearancePreviewInput(input), { signal })
          const id = await keep(preview, signal)
          previews.set(id, preview)
          preview.onDispose(() => {
            holds.delete(id)
            previews.delete(id)
            if (!revoked) {
              rpc.notify('preview.ended', owner)
            }
          })
          return id
        },
        /** Updates the identified preview while its owning editor still holds it. */
        'themes.updatePreview': async ([id, input]) => {
          const preview = previews.get(textArgument(id))
          if (!preview) {
            throw new DesktopError('InstanceExpired', 'This preview has ended')
          }
          await preview.update(parseAppearancePreviewInput(input))
        },
        ...files!.methods,
        /** Reads system registration and the actual current and next data locations. */
        'system.get': async (_, signal) => rpcData(await system.getState({ signal })),
        /** Applies a login-item choice and rereads the operating-system state. */
        'system.login': async ([enable], signal) =>
          rpcData(await system.setLoginItem(toggle(enable), { signal })),
        /** Requests protocol registration and reads the resulting handler association. */
        'system.protocol': async (_, signal) => rpcData(await system.registerProtocol({ signal })),
        /** Registers the movable Linux desktop entry when supported. */
        'system.desktopEntry': async (_, signal) =>
          rpcData(await system.registerDesktopEntry({ signal })),
        /** Opens the operating-system settings for the selected integration. */
        'system.settings': async ([target], signal) => {
          if (target !== 'loginItem' && target !== 'protocol') {
            throw new DesktopError('InvalidInput', 'Unknown registration')
          }
          await system.openSettings(target, { signal })
        },
        /** Prepares the explicitly selected data location for the next launch. */
        'system.portable': async ([change], signal) =>
          rpcData(await system.setDataMode(parseDataModeChange(change), { signal })),
        /** Reads the shareable version, operating system and process architecture. */
        'app.environment': (_, signal) => rpcData(environment({ signal })),
        /** Copies the shareable environment fields to the system clipboard. */
        'app.copyEnvironment': (_, signal) => copyEnvironment({ signal }),
      } satisfies Record<string, RpcMethod>)
    }

    const rpc = new RpcConnection(
      {
        /** Attaches incoming Electron frames and channel loss to the RPC endpoint. */
        start(receive, closed) {
          port1.on('message', (event) => receive(event.data))
          port1.once('close', closed)
          port1.start()
        },
        /** Delivers one RPC frame to the bound peer port. */
        send: (frame) => port1.postMessage(frame),
        /** Detaches listeners and closes this document's port. */
        close() {
          port1.removeAllListeners()
          port1.close()
        },
      },
      {
        protocol: windowProtocol,
        errors: windowErrors,
        handshake: {
          role: 'acceptor',
          /** Checks the compiled build and actual window kind before opening RPC. */
          accept(value) {
            if (
              !value ||
              typeof value !== 'object' ||
              !('buildId' in value) ||
              value.buildId !== __KISAKI_BUILD_ID__ ||
              value.windowKind !== kind
            ) {
              throw new RpcError('ProtocolMismatch', 'Window build or kind mismatch')
            }
            return { buildId: __KISAKI_BUILD_ID__ }
          },
        },
        methods: Object.fromEntries(
          Object.entries(methods).map(([name, method]) => [
            name,
            (...args: Parameters<RpcMethod>) => {
              const result = runWindowCall(name as keyof MainWindowApi, method, args, accepting)
              pending.add(result)
              void result.then(
                () => pending.delete(result),
                () => pending.delete(result),
              )
              return result
            },
          ]),
        ),
      },
    )
    connection = rpc
    const subscriptions: Array<{
      /** Releases one window subscription or retained resource. */
      dispose(): void | Promise<void>
    }> = []
    closeDocument = async () => {
      revoked = true
      const clean = [...holds.values(), ...subscriptions]
      holds.clear()
      await releaseAll([() => files?.close(), ...clean.map((hold) => () => hold.dispose())])
    }
    void rpc.ready
      .then(() => {
        if (revoked) {
          return
        }
        void application.log.record('window-connected')
        subscriptions.push(
          application.onUpdated(() => rpc.notify('window.changed', null)),
          appearance.onChanged(() => rpc.notify('appearance.changed', null)),
        )
        if (kind === 'main') {
          subscriptions.push(
            application.network.observe(() => rpc.notify('network.changed', null)),
            tasks.onInvalidated(() => rpc.notify('tasks.changed', null)),
            application.i18n.onInvalidated(() => rpc.notify('translations.changed', null)),
            fonts.onInvalidated(() => rpc.notify('fonts.changed', null)),
            appearance.themes.onInvalidated(() => rpc.notify('themes.changed', null)),
          )
        }
      })
      .catch((cause) => {
        if (!revoked) {
          firstReady.reject(cause)
        }
      })
    void rpc.closed.then(() => {
      if (connection === rpc) {
        reset()
      }
    })
    event.senderFrame.postMessage('kisaki-port', null, [port2])
  })

  /** Ends the native window after its document's accepted writes and resources finish. */
  async function destroy() {
    destroying = true
    await releaseAll([
      () => overlaySettings?.dispose(),
      async () => {
        if (!window.isDestroyed()) {
          await geometry.save(window).catch(console.error)
        }
      },
      reset,
      () => {
        if (!window.isDestroyed()) {
          window.destroy()
        }
      },
      () => Promise.allSettled([...pending]),
      () => cleanup,
      () => view.dispose(),
      () => ses.protocol.unhandle('kisaki-app'),
      () => {
        if (devUrl) {
          ses.webRequest.onHeadersReceived(null)
        }
      },
      () => ses.setPermissionRequestHandler(null),
      () => ses.setPermissionCheckHandler(null),
      detach,
    ])
  }
  /** Coalesces close, renderer loss and startup cleanup into the same release. */
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

  try {
    void application.log.record('document-loading')
    await window.loadURL(documentUrl)
    void application.log.record('document-loaded')
  } catch (error) {
    await dispose()
    throw error
  }
  return {
    window,
    dispose,
    show,
    firstReady: firstReady.promise,
    /** Closes or reopens admission of document mutations during exit. */
    setAccepting(enabled: boolean) {
      accepting = enabled
    },
    /** Waits for all operations already admitted by this window. */
    async drain() {
      await Promise.allSettled([...pending])
    },
    /** Requests the current editor's close decision. */
    async canClose(signal: AbortSignal) {
      if (!connection) {
        return true
      }
      return (await connection.request('window.confirmClose', [], { signal })) === true
    },
  }
}
