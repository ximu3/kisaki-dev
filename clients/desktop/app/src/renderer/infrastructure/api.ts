/** @fileoverview Connects a native Solid document to the actual window endpoint and maintains its live presentation. */

import { RpcConnection } from '@kisaki3/desktop-rpc'
import type { RpcNotification } from '@kisaki3/desktop-rpc'
import type { ViewAppearance } from '@kisaki3/desktop-contracts/appearance'
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
    /** Receives the port posted by this document's own verified preload. */
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
  /** Stores the document owner's current close decision callback. */
  let confirmClose: () => boolean | Promise<boolean> = () => true
  /** Stores this instance's native navigation receiver. */
  let navigate: (target: unknown) => void | Promise<void> = () => {}
  const notifications = Object.fromEntries(
    [
      'window.changed',
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
        'window.confirmClose': () => confirmClose(),
        /** Delivers a main-owned native destination to this document. */
        'window.navigate': ([target]) => navigate(target),
      },
      notifications: { topics: notifications, onError: console.error },
    },
  )
  await rpc.ready
  /** Selects the method surface allowed by the document kind. */
  type Api = K extends 'main' ? MainWindowApi : WindowApi
  /** Calls one declared operation using only its transferable arguments. */
  const call = async <M extends keyof Api & keyof MainWindowApi>(
    method: M,
    ...args: Parameters<MainWindowApi[M]>
  ): Promise<ReturnType<MainWindowApi[M]>> => {
    const values = rpcData<Parameters<MainWindowApi[keyof MainWindowApi]>>(args)
    return (await rpc.request(method, values)) as ReturnType<MainWindowApi[M]>
  }
  /** Built-in presentation methods common to every document kind. */
  const common = async <M extends keyof WindowApi>(method: M, ...args: Parameters<WindowApi[M]>) =>
    (await rpc.request(method, rpcData(args))) as ReturnType<WindowApi[M]>
  /** Keeps formatting reactive without remounting editors on a language change. */
  const [translate, setTranslate] = createSignal<Translate>(createTranslator('en'))
  let platform: Awaited<ReturnType<WindowApi['window.state']>>['platform']
  let generation = 0
  let held: string | undefined
  let installed: FontFace[] = []
  /** Applies the full visual branch and scale together in this document. */
  async function applyPalette(value: ViewAppearance) {
    const style = document.documentElement.style
    for (const [key, css] of Object.entries(value.cssVariables)) {
      style.setProperty(key, css)
    }
    style.setProperty('--interface-scale', String(value.interfaceScale))
    style.colorScheme = value.colorScheme
    document.documentElement.dataset.colorScheme = value.colorScheme
    if (kind === 'main' && platform === 'win32') {
      const sample = document.createElement('canvas')
      sample.width = sample.height = 1
      const context = sample.getContext('2d', { willReadFrequently: true })!
      context.globalCompositeOperation = 'copy'
      /** Resolves modern CSS colors to the sRGB bytes accepted by Electron's native overlay. */
      const color = (token: '--chrome' | '--chrome-foreground') => {
        context.fillStyle = value.cssVariables[token]
        context.fillRect(0, 0, 1, 1)
        // Electron's eight-digit hex format puts alpha before red, green and blue.
        const bytes = context.getImageData(0, 0, 1, 1).data
        return (
          '#' +
          [bytes[3]!, bytes[0]!, bytes[1]!, bytes[2]!]
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('')
        )
      }
      await rpc.request('window.caption', [color('--chrome'), color('--chrome-foreground')])
    }
  }

  /** Replaces the complete document font set and releases superseded bindings, including late reads. */
  async function refreshAppearance() {
    const version = ++generation
    const result = await common('appearance.get')
    const value = result.value
    const loaded = await Promise.allSettled(
      value.fontFaces.map((face) =>
        new FontFace(face.family, 'url(' + JSON.stringify(face.url) + ')', face.descriptors).load(),
      ),
    )
    if (version !== generation) {
      await common('resources.release', result.hold)
      return
    }
    for (const face of installed) {
      document.fonts.delete(face)
    }
    installed = loaded.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
    for (const face of installed) {
      document.fonts.add(face)
    }
    const applied = applyPalette(value)
    const old = held
    held = result.hold
    if (old) {
      await common('resources.release', old)
    }
    await applied
  }
  /** Updates the active translator without remounting draft-owning components. */
  async function refreshLanguage() {
    const state = await common('window.state')
    platform = state.platform
    document.documentElement.lang = state.locale
    const translate = createTranslator(state.locale, state.messages)
    setTranslate(() => translate)
    return state.startupDeadline
  }
  topics.addEventListener('window.changed', () => void refreshLanguage().catch(console.error))
  topics.addEventListener('appearance.changed', () => void refreshAppearance().catch(console.error))
  window.addEventListener('pagehide', () => rpc.close(), { once: true })
  const deadline = await refreshLanguage()
  const base = common('appearance.base').then((value) => {
    if (!held && generation <= 1) {
      return applyPalette(value)
    }
  })
  const initial = Promise.all([base, refreshAppearance()])
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
    /** Reports the running application's platform for shortcut interpretation. */
    get platform() {
      return platform
    },
    topics,
    t: ((...args) => translate()(...args)) as Translate,
    /** Registers this document's dirty-editor close workflow. */
    onClose(handler: typeof confirmClose) {
      confirmClose = handler
    },
    /** Registers the navigation receiver belonging to this document. */
    onNavigate(handler: typeof navigate) {
      navigate = handler
    },
    /** Acknowledges that this document is ready to receive native actions. */
    ready: () => common('window.ready'),
  }
}

/** Main-document client with the management surface selected by its actual kind. */
export type MainClient = Awaited<ReturnType<typeof connect<'main'>>>
