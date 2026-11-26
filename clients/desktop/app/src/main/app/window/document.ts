import { app, MessageChannelMain, type BrowserWindow } from 'electron'
import { RpcConnection, RpcError, type RpcMethod } from '@kisaki3/desktop-rpc'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { Disposable } from '@kisaki3/desktop-contracts/operations'
import type { ApplicationExitApi } from '@kisaki3/desktop-contracts/app'
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
import type { Application } from '../compose'
import { textArgument } from './values'
import { runWindowCall, windowMethod, type WindowMethods } from './admission'
import { openDocumentFileInputs, type DocumentFileInputs } from './file-inputs'
import { createDocumentResources } from './resources'
import { createAppearanceMethods } from './methods/appearance'
import { createApplicationMethods } from './methods/application'
import { createSettingsMethods } from './methods/settings'
import { createTaskMethods } from './methods/tasks'
import { createThemeMethods } from './methods/themes'
import { createFontMethods } from './methods/fonts'
import { createImageMethods } from './methods/images'
import { createSystemMethods } from './methods/system'

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
  onReady: (navigate: (target: NativeViewTarget) => Promise<void>) => void
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
  onReady,
  onStartupError,
}: DocumentOptions) {
  const { appearance, tasks, system, fonts } = application
  const { port1, port2 } = new MessageChannelMain()
  let revoked = false
  const resources = createDocumentResources(view, () => revoked)
  const commonMethods: WindowMethods<keyof WindowApi> = {
    'window.ready': windowMethod('read', () => {
      void application.log.record('window-ready')
      onReady(async (target) => {
        await rpc.request('window.navigate', [rpcData(target)])
        if (!revoked) {
          show()
        }
      })
    }),
    'window.state': windowMethod('read', () =>
      rpcData({
        startupDeadline: application.presentationDeadline,
        applicationName: app.name,
        kind,
        platform: process.platform,
        buildId: __KISAKI_BUILD_ID__,
        titlebarHeight: kind === 'main' ? titlebarHeight() : null,
        locale: application.i18n.current.locale,
        messages: application.i18n.current.messages,
      }),
    ),
    ...createAppearanceMethods(appearance, view, resources),
    'resources.release': windowMethod('control', ([id]) => resources.release(textArgument(id))),
  }

  let fileInputs: DocumentFileInputs | undefined
  let mainMethods: WindowMethods<Exclude<keyof MainWindowApi, keyof WindowApi>> | undefined
  if (kind === 'main') {
    fileInputs = openDocumentFileInputs(window.webContents, () => !revoked && isAccepting())
    mainMethods = {
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
      ...createApplicationMethods(lifecycle, restart),
      ...createSettingsMethods(application),
      ...createTaskMethods(tasks, resources, (state) => rpc.notify('tasks.state', rpcData(state))),
      ...createThemeMethods(
        appearance,
        resources,
        () => application.i18n.current.locale,
        (request) => {
          if (!revoked) {
            rpc.notify('preview.ended', request)
          }
        },
      ),
      ...createFontMethods(fonts, window, resources, fileInputs),
      ...createImageMethods(application.images, window, resources, fileInputs),
      ...createSystemMethods(system),
    }
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
    await releaseAll([
      () => fileInputs?.close(),
      ...resources.takeDisposers(),
      ...subscriptions.map((subscription) => () => subscription.dispose()),
    ])
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
