import { randomUUID } from 'node:crypto'
import { MessageChannelMain, type BrowserWindow } from 'electron'
import { RpcConnection, RpcError, type RpcMethod } from '@kisaki3/desktop-rpc'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { Disposable } from '@kisaki3/desktop-contracts/operations'
import { parseTaskRunRef } from '@kisaki3/desktop-contracts/tasks'
import {
  parseThemeRef,
  parseUserThemeCreate,
  parseUserThemeUpdate,
  parseAppearancePreviewInput,
  type AppearancePreview,
} from '@kisaki3/desktop-contracts/appearance'
import { parseDataModeChange, type ApplicationExitApi } from '@kisaki3/desktop-contracts/app'
import type { ViewResourcesApi } from '@kisaki3/desktop-contracts/resources'
import type { NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import type { MainWindowApi, WindowApi } from '../../../shared/window-api'
import {
  rpcData,
  windowProtocol,
  windowErrors,
  type WindowKind,
} from '../../../shared/window-api/protocol'
import { releaseAll } from '../../infrastructure/release'
import { environment, copyEnvironment } from '../../infrastructure/environment'
import type { Application } from '../compose'
import { toggle, textArgument } from './values'
import { runWindowCall, windowMethod, type WindowMethods } from './admission'
import { createFileMethods } from './files'

interface DocumentOptions {
  application: Application
  kind: WindowKind
  window: BrowserWindow
  view: ViewResourcesApi
  lifecycle: ApplicationExitApi
  controlsOverlay: boolean
  titlebarHeight: () => number
  show: () => void
  restart: () => void

  isAccepting: () => boolean
  trackCall: (call: Promise<unknown>) => void
  onNavigationReady: (navigate: (target: NativeViewTarget) => Promise<void>) => Promise<void>
  onReady: () => void
  onStartupError: (cause: unknown) => void
}

export function openWindowDocument({
  application,
  kind,
  window,
  view,
  lifecycle,
  controlsOverlay,
  titlebarHeight,
  show,
  restart,
  isAccepting,
  trackCall,
  onNavigationReady,
  onReady,
  onStartupError,
}: DocumentOptions) {
  const { appearance, tasks, preferences, system, fonts } = application
  const { port1, port2 } = new MessageChannelMain()
  const holds = new Map<string, Disposable>()
  const previews = new Map<string, AppearancePreview>()
  let revoked = false

  async function keep(hold: Disposable, signal: AbortSignal) {
    if (revoked || signal.aborted) {
      await hold.dispose()
      signal.throwIfAborted()
      throw new DesktopError('ConnectionClosed', 'The window document ended')
    }

    const id = randomUUID()
    holds.set(id, hold)
    return id
  }

  async function release(id: string) {
    const hold = holds.get(id)
    holds.delete(id)
    files?.forget(id)
    previews.delete(id)
    await hold?.dispose()
  }

  const files =
    kind === 'main'
      ? createFileMethods(application, window, view, keep, release, () => !revoked && isAccepting())
      : undefined

  const commonMethods: WindowMethods<keyof WindowApi> = {
    'window.ready': windowMethod('read', async () => {
      void application.log.record('window-ready')
      await onNavigationReady(async (target) => {
        await rpc.request('window.navigate', [rpcData(target)])
        show()
      })
      if (!revoked) {
        onReady()
      }
    }),
    'window.state': windowMethod('read', () =>
      rpcData({
        startupDeadline: application.presentationDeadline,
        kind,
        platform: process.platform,
        buildId: __KISAKI_BUILD_ID__,
        titlebarHeight: kind === 'main' ? titlebarHeight() : null,
        locale: application.i18n.current.locale,
        messages: application.i18n.current.messages,
      }),
    ),
    'appearance.get': windowMethod('acquire', async (_, signal) => {
      const read = await appearance.forView(view, { signal })
      return rpcData({
        value: read.appearance,
        fontFamilies: read.fontFamilies,
        issues: read.issues,
        hold: await keep(read, signal),
      })
    }),
    'appearance.base': windowMethod('read', async () => rpcData(await appearance.base())),
    'resources.release': windowMethod('control', async ([id]) => release(textArgument(id))),
  }

  const mainMethods: WindowMethods<Exclude<keyof MainWindowApi, keyof WindowApi>> | undefined =
    files && {
      'window.reveal': windowMethod('read', show),
      'window.caption': windowMethod('read', ([color, symbolColor]) => {
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
      }),
      'app.restart': windowMethod('control', () => {
        setImmediate(restart)
      }),
      'app.cancelExit': windowMethod('control', (_, signal) => lifecycle.cancel({ signal })),
      'app.exitState': windowMethod('read', async (_, signal) =>
        rpcData(await lifecycle.getState({ signal })),
      ),

      'preferences.get': windowMethod('read', async (_, signal) =>
        rpcData(await preferences.get({ signal })),
      ),
      'preferences.defaults': windowMethod('read', async (_, signal) =>
        rpcData(await preferences.getDefaults({ signal })),
      ),
      'preferences.fields': windowMethod('read', async (_, signal) =>
        rpcData(await preferences.listFields({ signal })),
      ),
      'preferences.update': windowMethod('write', async ([value], signal) =>
        rpcData(await preferences.update(value, { signal })),
      ),
      'translations.list': windowMethod('read', (_, signal) =>
        rpcData(application.i18n.list({ signal })),
      ),
      'network.state': windowMethod('read', async (_, signal) =>
        rpcData(await application.network.getState({ signal })),
      ),

      'tasks.list': windowMethod('read', async ([query, options], signal) =>
        rpcData(await tasks.list(query, options, { signal })),
      ),
      'tasks.get': windowMethod('read', async ([ref], signal) =>
        rpcData(await tasks.get(parseTaskRunRef(ref), { signal })),
      ),
      'tasks.types': windowMethod('read', async () => rpcData(await tasks.types())),
      'tasks.wait': windowMethod('acquire', async ([ref], signal) =>
        rpcData(await tasks.wait(parseTaskRunRef(ref), { signal })),
      ),
      'tasks.observe': windowMethod('acquire', async ([ref], signal) =>
        keep(
          await tasks.observe(
            parseTaskRunRef(ref),
            (state) => rpc.notify('tasks.state', rpcData(state)),
            { signal },
          ),
          signal,
        ),
      ),
      'tasks.pause': windowMethod('acquire', async ([ref], signal) =>
        rpcData(await tasks.pause(parseTaskRunRef(ref), { signal })),
      ),
      'tasks.resume': windowMethod('control', async ([ref], signal) =>
        rpcData(await tasks.resume(parseTaskRunRef(ref), { signal })),
      ),
      'tasks.cancel': windowMethod('control', async ([ref], signal) =>
        rpcData(await tasks.cancel(parseTaskRunRef(ref), { signal })),
      ),
      'tasks.clear': windowMethod('write', async (_, signal) => tasks.clearHistory({}, { signal })),
      'tasks.delete': windowMethod('write', async ([ref], signal) =>
        tasks.deleteHistory(parseTaskRunRef(ref), { signal }),
      ),

      'themes.list': windowMethod('read', async (_, signal) =>
        rpcData(
          (await appearance.themes.list({ signal })).map((theme) => ({
            ref: theme.ref,
            name: appearance.themes.displayName(theme, application.i18n.current.locale),
          })),
        ),
      ),
      'themes.get': windowMethod('read', async ([ref], signal) =>
        rpcData(await appearance.themes.get(parseThemeRef(ref), { signal })),
      ),
      'themes.clone': windowMethod('write', async ([ref, name], signal) =>
        rpcData(
          await appearance.themes.clone(
            parseThemeRef(ref),
            { name: textArgument(name) },
            { signal },
          ),
        ),
      ),
      'themes.create': windowMethod('write', async ([input], signal) =>
        rpcData(await appearance.themes.create(parseUserThemeCreate(input), { signal })),
      ),
      'themes.update': windowMethod('write', async ([id, input], signal) =>
        appearance.themes.update(textArgument(id), parseUserThemeUpdate(input), { signal }),
      ),
      'themes.delete': windowMethod('write', async ([id], signal) =>
        appearance.themes.delete(textArgument(id), { signal }),
      ),
      'themes.preview': windowMethod('acquire', async ([request, input], signal) => {
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
      }),
      'themes.updatePreview': windowMethod('acquire', async ([id, input]) => {
        const preview = previews.get(textArgument(id))
        if (!preview) {
          throw new DesktopError('InstanceExpired', 'This preview has ended')
        }
        await preview.update(parseAppearancePreviewInput(input))
      }),

      ...files.methods,

      'system.get': windowMethod('read', async (_, signal) =>
        rpcData(await system.getState({ signal })),
      ),
      'system.login': windowMethod('write', async ([enable], signal) =>
        rpcData(await system.setLoginItem(toggle(enable), { signal })),
      ),
      'system.protocol': windowMethod('write', async (_, signal) =>
        rpcData(await system.registerProtocol({ signal })),
      ),
      'system.desktopEntry': windowMethod('write', async (_, signal) =>
        rpcData(await system.registerDesktopEntry({ signal })),
      ),
      'system.settings': windowMethod('acquire', async ([target], signal) => {
        if (target !== 'loginItem' && target !== 'protocol') {
          throw new DesktopError('InvalidInput', 'Unknown registration')
        }
        await system.openSettings(target, { signal })
      }),
      'system.portable': windowMethod('write', async ([change], signal) =>
        rpcData(await system.setDataMode(parseDataModeChange(change), { signal })),
      ),

      'app.environment': windowMethod('read', (_, signal) => rpcData(environment({ signal }))),
      'app.copyEnvironment': windowMethod('write', (_, signal) => copyEnvironment({ signal })),
    }
  const methods = { ...commonMethods, ...mainMethods }

  const rpc = new RpcConnection(
    {
      start(receive, closed) {
        port1.on('message', (event) => receive(event.data))
        port1.once('close', closed)
        port1.start()
      },
      send: (frame) => port1.postMessage(frame),
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
            const result = runWindowCall(method, args, isAccepting())
            trackCall(result)
            return result
          },
        ]),
      ),
    },
  )

  const subscriptions: Disposable[] = []

  async function dispose() {
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
        onStartupError(cause)
      }
    })

  return { rpc, port: port2, dispose }
}
