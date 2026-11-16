/** @fileoverview Separates explicit cancellation of admitted writes from loss of their observing document. */

import { addAbortListener } from 'node:events'
import { RpcError, type RpcMethod } from '@kisaki3/desktop-rpc'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

/** Complete mutations that own their inputs after admission. */
const independent = new Set([
  'preferences.update',
  'themes.create',
  'themes.clone',
  'themes.update',
  'themes.delete',
  'fonts.import',
  'fonts.update',
  'fonts.editFiles',
  'fonts.delete',
  'system.login',
  'system.protocol',
  'system.desktopEntry',
  'system.portable',
])

/** New resource acquisitions and preview changes also stop during a confirmed exit attempt. */
const guarded = new Set([
  ...independent,
  'themes.preview',
  'themes.updatePreview',
  'fonts.choose',
  'fonts.prepareInput',
  'images.choose',
  'images.transform',
  'images.prepareInput',
])

/** Controls admission without cancelling accepted saves when the RPC document disappears. */
export async function runWindowCall(
  name: string,
  method: RpcMethod,
  [values, signal]: Parameters<RpcMethod>,
  accepting: boolean,
) {
  if (!accepting && guarded.has(name)) {
    throw new DesktopError('Busy', 'The application is closing')
  }
  if (!independent.has(name)) {
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
