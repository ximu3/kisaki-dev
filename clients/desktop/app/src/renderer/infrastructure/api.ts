/** @fileoverview Connects a native Solid document to the actual window endpoint and maintains its live presentation. */

import { RpcConnection } from '@kisaki3/desktop-rpc'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { RpcNotification } from '@kisaki3/desktop-rpc'
import { createDocumentAppearance } from './appearance'
import { createTranslator, type Translate } from '@kisaki3/desktop-localization'
import { createSignal } from 'solid-js'
import type { MainWindowApi, WindowApi } from '../../shared/window-api'
import {
  rpcData,
  windowProtocol,
  windowErrors,
  type WindowKind,
} from '../../shared/window-api/protocol'

/** Obtains a fresh connection for this top-level document and its selected method scope. */
export async function connect<K extends WindowKind>(kind: K) {
  for (const family of ['noto-sans-sc', 'noto-sans-mono']) {
    const sheet = document.createElement('link')
    sheet.rel = 'stylesheet'
    sheet.href = 'kisaki-app://window/fonts/' + family + '/wght.css'
    document.head.append(sheet)
  }
  const transport = await new Promise<MessagePort>((resolve) => {
    const receive = (event: MessageEvent) => {
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        event.data !== 'kisaki-port' ||
        !event.ports[0]
      ) {
        return
      }
      window.removeEventListener('message', receive)
      resolve(event.ports[0])
    }
    window.addEventListener('message', receive)
    window.postMessage('kisaki-connect', window.location.origin)
  })

  const topics = new EventTarget()
  let confirmClose: (signal: AbortSignal) => boolean | Promise<boolean> = () => true
  let navigate: ((target: unknown) => void | Promise<void>) | undefined
  const notifications = Object.fromEntries(
    [
      'window.changed',
      'network.changed',
      'appearance.changed',
      'tasks.changed',
      'tasks.state',
      'fonts.changed',
      'themes.changed',
      'translations.changed',
      'preview.ended',
    ].map((name) => [
      name,
      (value: unknown) => {
        topics.dispatchEvent(new CustomEvent(name, { detail: value }))
      },
    ]),
  ) as Record<string, RpcNotification>

  const rpc = new RpcConnection(
    {
      /** Installs ordered frame and channel-loss listeners on the browser port. */
      start(receive, closed) {
        transport.onmessage = (event) => receive(event.data)
        transport.onmessageerror = closed
        transport.addEventListener('close', closed)
        transport.start()
      },
      /** Hands off an RPC frame through the actual native port. */
      send: (frame) => transport.postMessage(frame),
      /** Closes this document's end of the channel. */
      close() {
        transport.close()
      },
    },
    {
      protocol: windowProtocol,
      errors: windowErrors,
      handshake: {
        role: 'initiator',
        context: { buildId: __KISAKI_BUILD_ID__, windowKind: kind },
        /** Verifies that the accepting endpoint belongs to the same program build. */
        accepts: (value) =>
          !!value &&
          typeof value === 'object' &&
          'buildId' in value &&
          value.buildId === __KISAKI_BUILD_ID__,
      },
      methods: {
        /** Obtains an actual close decision from the active editors. */
        'window.confirmClose': (_, signal) => confirmClose(signal),
        /** Delivers a main-owned native destination to this document. */
        'window.navigate': ([target]) => {
          if (!navigate) {
            throw new DesktopError('NotFound', 'This document has no navigation receiver')
          }
          return navigate(target)
        },
      },
      notifications: { topics: notifications, onError: console.error },
    },
  )
  await rpc.ready

  /** Selects the method surface allowed by the document kind. */
  type Api = K extends 'main' ? MainWindowApi : WindowApi
  const request = async <M extends keyof Api & keyof MainWindowApi>(
    signal: AbortSignal | undefined,
    method: M,
    ...args: Parameters<MainWindowApi[M]>
  ): Promise<ReturnType<MainWindowApi[M]>> => {
    const values = rpcData<Parameters<MainWindowApi[keyof MainWindowApi]>>(args)
    return (await rpc.request(method, values, signal ? { signal } : undefined)) as ReturnType<
      MainWindowApi[M]
    >
  }
  const call = <M extends keyof Api & keyof MainWindowApi>(
    method: M,
    ...args: Parameters<MainWindowApi[M]>
  ) => request(undefined, method, ...args)
  const common = async <M extends keyof WindowApi>(method: M, ...args: Parameters<WindowApi[M]>) =>
    (await rpc.request(method, rpcData(args))) as ReturnType<WindowApi[M]>
  const [translate, setTranslate] = createSignal<Translate>(() => createTranslator('en'))

  async function refreshWindowState() {
    const state = await common('window.state')
    const root = document.documentElement
    root.lang = state.locale
    if (state.titlebarHeight !== null) {
      root.style.setProperty('--main-titlebar-height', `${state.titlebarHeight}px`)
    }

    const translate = createTranslator(state.locale, state.messages)
    setTranslate(() => translate)
    return state
  }

  topics.addEventListener('window.changed', () => void refreshWindowState().catch(console.error))
  window.addEventListener('pagehide', () => rpc.close(), { once: true })
  const { platform, startupDeadline: deadline } = await refreshWindowState()
  const appearance = createDocumentAppearance(
    common,
    kind === 'main' && platform !== 'darwin'
      ? async (background, foreground) => {
          await rpc.request('window.caption', [background, foreground])
        }
      : undefined,
  )
  topics.addEventListener(
    'appearance.changed',
    () => void appearance.refresh().catch(console.error),
  )
  const initial = appearance.initialize()

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      initial,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, Math.max(0, deadline - Date.now()))
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
  return {
    call,
    request,
    /** Reports the running application's platform for shortcut interpretation. */
    platform,
    topics,
    t: ((...args) => translate()(...args)) as Translate,
    /** Registers this document's dirty-editor close workflow. */
    onClose(handler: typeof confirmClose) {
      confirmClose = handler
    },
    /** Registers the navigation receiver belonging to this document. */
    onNavigate(handler: NonNullable<typeof navigate>) {
      navigate = handler
    },
    /** Acknowledges that this document is ready to receive native actions. */
    ready: () => common('window.ready'),
  }
}

/** Main-document client with the management surface selected by its actual kind. */
export type MainClient = Awaited<ReturnType<typeof connect<'main'>>>
