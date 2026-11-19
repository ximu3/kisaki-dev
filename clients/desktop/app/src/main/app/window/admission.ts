/** @fileoverview Separates explicit cancellation of admitted writes from loss of their observing document. */

import type { MainWindowApi } from '../../../shared/window-api'
import { addAbortListener } from 'node:events'
import { RpcError, type RpcMethod } from '@kisaki3/desktop-rpc'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

/** Admission and lifetime for every declared window operation. */
const admission = {
  'window.ready': 'read',
  'window.state': 'read',
  'window.caption': 'read',
  'window.reveal': 'read',
  'app.restart': 'control',
  'app.cancelExit': 'control',
  'app.exitState': 'read',
  'resources.release': 'control',
  'appearance.get': 'acquire',
  'appearance.base': 'read',
  'preferences.get': 'read',
  'preferences.defaults': 'read',
  'preferences.fields': 'read',
  'preferences.update': 'write',
  'translations.list': 'read',
  'network.state': 'read',
  'tasks.list': 'read',
  'tasks.get': 'read',
  'tasks.types': 'read',
  'tasks.wait': 'acquire',
  'tasks.observe': 'acquire',
  'tasks.pause': 'acquire',
  'tasks.resume': 'control',
  'tasks.cancel': 'control',
  'tasks.clear': 'write',
  'tasks.delete': 'write',
  'themes.list': 'read',
  'themes.get': 'read',
  'themes.clone': 'write',
  'themes.create': 'write',
  'themes.update': 'write',
  'themes.delete': 'write',
  'themes.preview': 'acquire',
  'themes.updatePreview': 'acquire',
  'fonts.list': 'read',
  'fonts.get': 'read',
  'fonts.open': 'acquire',
  'fonts.system': 'read',
  'fonts.choose': 'acquire',
  'fonts.prepareInput': 'acquire',
  'fonts.import': 'write',
  'fonts.update': 'write',
  'fonts.editFiles': 'write',
  'fonts.delete': 'write',
  'images.choose': 'acquire',
  'images.prepareInput': 'acquire',
  'images.transform': 'acquire',
  'system.get': 'read',
  'system.login': 'write',
  'system.protocol': 'write',
  'system.desktopEntry': 'write',
  'system.settings': 'acquire',
  'system.portable': 'write',
  'app.environment': 'read',
  'app.copyEnvironment': 'write',
} as const satisfies Record<keyof MainWindowApi, 'read' | 'control' | 'acquire' | 'write'>

/** Controls admission without cancelling accepted saves when the RPC document disappears. */
export async function runWindowCall(
  name: keyof MainWindowApi,
  method: RpcMethod,
  [values, signal]: Parameters<RpcMethod>,
  accepting: boolean,
) {
  signal.throwIfAborted()
  const kind = admission[name]
  if (!accepting && (kind === 'acquire' || kind === 'write')) {
    throw new DesktopError('Busy', 'The application is closing')
  }
  if (kind !== 'write') {
    return method(values, signal)
  }
  const owner = new AbortController()
  const cancellation = addAbortListener(signal, () => {
    const reason: unknown = signal.reason
    if (reason instanceof RpcError && reason.code !== 'Cancelled') {
      return
    }
    owner.abort(reason)
  })
  try {
    return await method(values, owner.signal)
  } finally {
    cancellation[Symbol.dispose]()
  }
}
