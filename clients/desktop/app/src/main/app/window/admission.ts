import { addAbortListener } from 'node:events'
import { RpcError, type RpcMethod } from '@kisaki3/desktop-rpc'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { MainWindowApi } from '../../../shared/window-api'

type WindowAdmission = 'read' | 'control' | 'acquire' | 'write'

interface WindowMethod {
  admission: WindowAdmission
  invoke: RpcMethod
}

export type WindowMethods<Name extends string> = Record<Name, WindowMethod>

type WindowNamespace = keyof MainWindowApi extends `${infer Name}.${string}` ? Name : never

export type WindowMethodGroup<Group extends WindowNamespace> = WindowMethods<
  Extract<keyof MainWindowApi, `${Group}.${string}`>
>

export function windowMethod(admission: WindowAdmission, invoke: RpcMethod): WindowMethod {
  return { admission, invoke }
}

export async function runWindowCall(
  { admission, invoke }: WindowMethod,
  [values, signal]: Parameters<RpcMethod>,
  accepting: boolean,
) {
  signal.throwIfAborted()
  if (!accepting && (admission === 'acquire' || admission === 'write')) {
    throw new DesktopError('Busy', 'The application is closing')
  }

  if (admission !== 'write') {
    return invoke(values, signal)
  }

  const owner = new AbortController()
  const cancellation = addAbortListener(signal, () => {
    // A dropped document ends the call's observation. Accepted writes have their own lifetime.
    const reason: unknown = signal.reason
    if (reason instanceof RpcError && reason.code !== 'Cancelled') {
      return
    }
    owner.abort(reason)
  })
  try {
    return await invoke(values, owner.signal)
  } finally {
    cancellation[Symbol.dispose]()
  }
}
