import { createSignal, onCleanup } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { parseNativeViewTarget, type NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import type { MainClient } from '../../../../infrastructure/api'
import { waitForDecision } from '../../../../infrastructure/dialogs/closing'
import type { createWindowEditors } from '../../../../infrastructure/dialogs/editors'
import type { NavigableDialog } from '../../../../infrastructure/dialogs/presentation'

export type Destination = (view: NavigableDialog) => JSX.Element

export function createNavigation(
  api: MainClient,
  editors: ReturnType<typeof createWindowEditors>,
  resolve: (target: NativeViewTarget, signal: AbortSignal) => Promise<Destination>,
) {
  const [current, setCurrent] = createSignal<ReturnType<typeof openDestination>>()
  let pending: AbortController | undefined

  function openDestination(destination: Destination) {
    const [open, setOpen] = createSignal(true)
    const shown = Promise.withResolvers<boolean>()
    const lifetime = new AbortController()
    let presented = false
    let retarget: Parameters<NavigableDialog['onNavigate']>[0] | undefined

    function close() {
      lifetime.abort()
      shown.resolve(false)
      retarget = undefined
      setOpen(false)
    }

    const view: NavigableDialog = {
      open,
      close,
      presented() {
        presented = true
        shown.resolve(true)
      },
      failed: shown.reject,
      onNavigate: (handler) => {
        retarget = handler
      },
    }
    return {
      open,
      close,
      shown: shown.promise,
      render: () => destination(view),
      async retarget(target: NativeViewTarget, signal: AbortSignal) {
        if (presented && retarget) {
          try {
            return await retarget(target, AbortSignal.any([signal, lifetime.signal]))
          } catch (error) {
            if (!lifetime.signal.aborted) {
              throw error
            }
          }
        }
        return false
      },
    }
  }

  async function navigate(target: NativeViewTarget, signal?: AbortSignal) {
    pending?.abort()
    const request = new AbortController()
    pending = request
    const wait = signal ? AbortSignal.any([signal, request.signal]) : request.signal

    try {
      const active = current()
      if (active?.open()) {
        const handled = await active.retarget(target, wait)
        if (handled || !active.open()) {
          return !!handled && active.open() && !wait.aborted
        }
      }
      wait.throwIfAborted()

      const destination = await resolve(target, wait)
      if (!(await editors.canLeave(wait))) {
        return false
      }

      const next = openDestination(destination)
      active?.close()
      setCurrent(next)
      let accepted = false
      try {
        accepted = await waitForDecision(next.shown, wait)
        return accepted
      } finally {
        if (!accepted) {
          next.close()
        }
      }
    } catch (error) {
      if (wait.aborted) {
        return false
      }
      throw error
    } finally {
      if (pending === request) {
        pending = undefined
      }
    }
  }

  onCleanup(() => {
    pending?.abort()
    current()?.close()
  })
  api.onClose(editors.canLeave)
  api.onNavigate(async (raw, signal) => {
    if (!(await navigate(parseNativeViewTarget(raw), signal))) {
      throw new DesktopError('Cancelled', api.t('runtime.keepEditing'))
    }
  })

  return { current, navigate }
}
