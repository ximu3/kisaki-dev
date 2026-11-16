/** @fileoverview Binds native windows to verified documents, scoped resource URLs and explicitly selected RPC methods. */

import { app, BrowserWindow, MessageChannelMain, session } from 'electron'
import { windowGeometry } from '../../infrastructure/windows/geometry'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { serveDocument } from '../../infrastructure/windows/document'
import { toggle, textArgument } from './values'
import { runWindowCall } from './admission'
import { createFileMethods } from './files'
import { RpcConnection, RpcError, type RpcMethod } from '@kisaki3/desktop-rpc'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { parseJsonValue } from '@kisaki3/desktop-contracts/json'
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
import { windowProtocol, windowErrors, type WindowKind } from '../../../shared/window-api/protocol'
import { parseDataModeChange, type ApplicationExitApi } from '@kisaki3/desktop-contracts/app'
import { environment, copyEnvironment } from '../../infrastructure/environment'
import type { Application } from '../compose'

/** Creates one native window with its document session and closes every old endpoint on navigation. */
export async function createWindow(
  application: Application,
  kind: WindowKind,
  devUrl: string | undefined,
  lifecycle: ApplicationExitApi,
  onClose: () => void,
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
      frame: process.platform === 'darwin',
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
  const ready = Promise.withResolvers<void>()
  void ready.promise.catch(() => {})
  let connection: RpcConnection | undefined
  /** Releases the current document's subscriptions and held resources on replacement. */
  let closeDocument: () => Promise<void> = async () => {}
  let cleanup = Promise.resolve()
  let destroying = false
  let disposal: Promise<void> | undefined
  let accepting = true
  const pending = new Set<Promise<unknown>>()
  const { system } = application

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
    connection?.close()
    connection = undefined
    const dispose = closeDocument
    closeDocument = async () => {}
    cleanup = Promise.all([cleanup, dispose()]).then(() => {})
    void cleanup.catch(console.error)
  }
  contents.on('did-start-navigation', (_event, _url, inPlace, mainFrame) => {
    if (mainFrame && !inPlace) {
      reset()
    }
  })
  contents.on('render-process-gone', () => {
    reset()
    ready.reject(new Error('The window document exited'))
  })
  window.on('close', (event) => {
    if (!destroying) {
      event.preventDefault()
      onClose()
    }
  })
  window.once('closed', () => {
    reset()
    ready.reject(new Error('The window was closed during startup'))
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
    function keep(hold: {
      /** Ends this individual document hold. */
      dispose(): void | Promise<void>
    }) {
      if (revoked) {
        void Promise.resolve(hold.dispose()).catch(console.error)
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
      'window.ready': () => {
        ready.resolve()
      },
      /** Reads the bound window identity, native state and effective language snapshot. */
      'window.state': () =>
        parseJsonValue({
          startupDeadline: application.presentationDeadline,
          kind,
          platform: process.platform,
          buildId: __KISAKI_BUILD_ID__,
          maximized: window.isMaximized(),
          locale: application.i18n.current.locale,
          messages: application.i18n.current.messages,
        }),
      /** Minimizes only the native window bound to this connection. */
      'window.minimize': () => window.minimize(),
      /** Toggles the bound window between maximized and restored bounds. */
      'window.maximize': () => {
        if (window.isMaximized()) {
          window.unmaximize()
        } else {
          window.maximize()
        }
      },
      /** Requests the configured close behavior for this native window. */
      'window.close': () => window.close(),
      /** Resolves the effective branch and acquires font URLs for this document. */
      'appearance.get': async () => {
        const read = await appearance.forView(view)
        return parseJsonValue({ value: read.appearance, issues: read.issues, hold: keep(read) })
      },
      /** Reads the palette and scale available before document font loading finishes. */
      'appearance.base': async () => parseJsonValue(await appearance.base()),
      /** Releases the identified hold in this document without affecting other readers. */
      'resources.release': async ([id]) => release(textArgument(id)),
    }
    if (kind === 'main') {
      Object.assign(methods, {
        /** Starts the shared normal exit workflow from the main window. */
        'app.quit': () => {
          setImmediate(() => app.quit())
        },
        /** Restarts the application after the normal close workflow succeeds. */
        'app.restart': () => {
          setImmediate(() => {
            void lifecycle.restart().catch(console.error)
          })
        },
        /** Cancels a pending exit while preserving work already completed. */
        'app.cancelExit': () => lifecycle.cancel(),
        /** Reads the current close attempt and its progress. */
        'app.exitState': async () => parseJsonValue(await lifecycle.getState()),
        /** Reads saved preference fields and the opaque proxy credential revision. */
        'preferences.get': async () => parseJsonValue(await preferences.get()),
        /** Reads the complete default values for a reset draft. */
        'preferences.defaults': async () => parseJsonValue(await preferences.getDefaults()),
        /** Reads labels and search destinations from the preference owner. */
        'preferences.fields': async () => parseJsonValue(await preferences.listFields()),
        /** Validates the submitted fields and commits them against their baselines. */
        'preferences.update': async ([value], signal) =>
          parseJsonValue(await preferences.update(parsePreferencesUpdate(value), { signal })),
        /** Lists built-in and registered translations by stable identity. */
        'translations.list': () => parseJsonValue(application.i18n.list()),
        /** Reads whether new requests can use the selected network route. */
        'network.state': async () => parseJsonValue(await application.network.getState()),
        /** Reads one filtered interval of summaries and its total. */
        'tasks.list': async ([query, options]) =>
          parseJsonValue(await tasks.list(parseTaskQuery(query), parseListOptions(options))),
        /** Reads a full task record, returning null when history is absent. */
        'tasks.get': async ([ref]) => parseJsonValue(await tasks.get(parseTaskRunRef(ref))),
        /** Reads only the distinct type values for the task filter. */
        'tasks.types': async () => parseJsonValue(await tasks.types()),
        /** Waits for a terminal record independently of the underlying execution. */
        'tasks.wait': async ([ref], signal) =>
          parseJsonValue(await tasks.wait(parseTaskRunRef(ref), { signal })),
        /** Acquires an ordered, lightweight task observation for this document. */
        'tasks.observe': async ([ref]) =>
          keep(
            await tasks.observe(parseTaskRunRef(ref), (state) =>
              rpc.notify('tasks.state', parseJsonValue(state)),
            ),
          ),
        /** Requests a pause at the next business checkpoint. */
        'tasks.pause': async ([ref]) => parseJsonValue(await tasks.pause(parseTaskRunRef(ref))),
        /** Releases a reached pause or withdraws a pending one. */
        'tasks.resume': async ([ref]) => parseJsonValue(await tasks.resume(parseTaskRunRef(ref))),
        /** Requests cancellation and returns the acknowledged control state. */
        'tasks.cancel': async ([ref]) => parseJsonValue(await tasks.cancel(parseTaskRunRef(ref))),
        /** Clears matching finished history while protecting admitted runs. */
        'tasks.clear': async ([filter]) => {
          return tasks.clearHistory(parseTaskQuery(filter ?? {}))
        },
        /** Lists available theme identities with names resolved for this window. */
        'themes.list': async () =>
          parseJsonValue(
            (await appearance.themes.list()).map((theme) => ({
              ref: theme.ref,
              name: appearance.themes.displayName(theme, application.i18n.current.locale),
            })),
          ),
        /** Reads a complete theme definition without acquiring font files. */
        'themes.get': async ([ref]) =>
          parseJsonValue(await appearance.themes.get(parseThemeRef(ref))),
        /** Creates a user theme and adopts any required private font copies atomically. */
        'themes.clone': async ([ref, name], signal) =>
          parseJsonValue(
            await appearance.themes.clone(
              parseThemeRef(ref),
              { name: textArgument(name) },
              { signal },
            ),
          ),
        /** Creates an independent user theme with both color branches. */
        'themes.create': async ([input]) =>
          parseJsonValue(await appearance.themes.create(parseUserThemeCreate(input))),
        /** Compares the edited name and individual tokens before committing the theme. */
        'themes.update': async ([id, input]) =>
          appearance.themes.update(textArgument(id), parseUserThemeUpdate(input)),
        /** Removes a user theme while retaining its fonts and saved selection references. */
        'themes.delete': async ([id]) => appearance.themes.delete(textArgument(id)),
        /** Acquires the application preview for this document after validating its branch. */
        'themes.preview': async ([input]) => {
          const preview = await appearance.preview(parseAppearancePreviewInput(input))
          const id = keep(preview)
          previews.set(id, preview)
          preview.onDispose(() => {
            holds.delete(id)
            previews.delete(id)
            if (!revoked) {
              rpc.notify('preview.ended', id)
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
        'system.get': async () => parseJsonValue(await system.getState()),
        /** Applies a login-item choice and rereads the operating-system state. */
        'system.login': async ([enable]) =>
          parseJsonValue(await system.setLoginItem(toggle(enable))),
        /** Requests protocol registration and reads the resulting handler association. */
        'system.protocol': async () => parseJsonValue(await system.registerProtocol()),
        /** Registers the movable Linux desktop entry when supported. */
        'system.desktopEntry': async () => parseJsonValue(await system.registerDesktopEntry()),
        /** Opens the operating-system settings for the selected integration. */
        'system.settings': async ([target]) => {
          if (target !== 'loginItem' && target !== 'protocol') {
            throw new DesktopError('InvalidInput', 'Unknown registration')
          }
          await system.openSettings(target)
        },
        /** Prepares the explicitly selected data location for the next launch. */
        'system.portable': async ([change]) =>
          parseJsonValue(await system.setDataMode(parseDataModeChange(change))),
        /** Reads the shareable version, operating system and process architecture. */
        'app.environment': () => parseJsonValue(environment()),
        /** Copies the shareable environment fields to the system clipboard. */
        'app.copyEnvironment': () => copyEnvironment(),
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
              const result = runWindowCall(name, method, args, accepting)
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
      files?.close()
      const clean = [...holds.values(), ...subscriptions]
      holds.clear()
      await Promise.all(
        clean.map(async (hold) => {
          await hold.dispose()
        }),
      )
    }
    void rpc.ready
      .then(() => {
        subscriptions.push(
          application.onUpdated(() => rpc.notify('window.changed', null)),
          appearance.onChanged(() => rpc.notify('appearance.changed', null)),
        )
        if (kind === 'main') {
          subscriptions.push(
            tasks.onInvalidated(() => rpc.notify('tasks.changed', null)),
            application.i18n.onInvalidated(() => rpc.notify('translations.changed', null)),
            fonts.onInvalidated(() => rpc.notify('fonts.changed', null)),
            appearance.themes.onInvalidated(() => rpc.notify('themes.changed', null)),
          )
        }
      })
      .catch((cause) => ready.reject(cause))
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
    if (!window.isDestroyed()) {
      await geometry.save(window).catch(console.error)
    }
    reset()
    if (!window.isDestroyed()) {
      window.destroy()
    }
    await Promise.allSettled([...pending])
    await cleanup
    await view.dispose()
    ses.protocol.unhandle('kisaki-app')
    if (devUrl) {
      ses.webRequest.onHeadersReceived(null)
    }
    ses.setPermissionRequestHandler(null)
    ses.setPermissionCheckHandler(null)
    await detach()
  }
  /** Coalesces close, renderer loss and startup cleanup into the same release. */
  function dispose() {
    return (disposal ??= destroy())
  }
  try {
    await window.loadURL(documentUrl)
  } catch (error) {
    await dispose()
    throw error
  }
  return {
    window,
    dispose,
    ready: ready.promise,
    /** Closes or reopens admission of document mutations during exit. */
    setAccepting(enabled: boolean) {
      accepting = enabled
    },
    /** Waits for all operations already admitted by this window. */
    async drain() {
      await Promise.allSettled([...pending])
    },
    /** Requests the current editor's close decision. */
    async canClose() {
      if (!connection) {
        return true
      }
      return (await connection.request('window.confirmClose')) === true
    },
    /** Delivers a navigation target to the actual ready window. */
    async navigate(target: unknown) {
      if (!connection) {
        throw new DesktopError('ConnectionClosed', 'The window is not ready for navigation')
      }
      await connection.request('window.navigate', [parseJsonValue(target)])
    },
  }
}
