import { createSignal, onCleanup } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { parseNativeViewTarget, type NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import type { MainClient } from '../../../../infrastructure/api'
import type { createWindowEditors } from '../../../../infrastructure/dialogs/editors'
import type { NavigableDialog } from '../../../../infrastructure/dialogs/presentation'

export type Destination = (view: NavigableDialog) => JSX.Element

function openDestination(destination: Destination, origin: Element | null) {
  const [open, setOpen] = createSignal(true)
  const shown = Promise.withResolvers<boolean>()
  const lifetime = new AbortController()
  let retarget: Parameters<NavigableDialog['onNavigate']>[0] | undefined

  function close() {
    lifetime.abort()
    shown.resolve(false)
    retarget = undefined
    setOpen(false)
  }

  const view: NavigableDialog = {
    open,
    close() {
      const modal = document.activeElement?.closest('dialog')
      function restoreFocus() {
        const focused = document.activeElement
        if (
          (focused === document.body || modal?.contains(focused)) &&
          origin instanceof HTMLElement &&
          origin.isConnected
        ) {
          origin.focus({ preventScroll: true })
        }
      }
      // A replacement can outlive its previous modal. Restore the original trigger after native close.
      if (modal?.open) {
        modal.addEventListener('close', restoreFocus, { once: true })
      } else {
        restoreFocus()
      }
      close()
    },
    receipt: { presented: () => shown.resolve(true), failed: shown.reject },
    onNavigate: (handler) => {
      retarget = handler
    },
  }
  return {
    open,
    close,
    origin,
    shown: shown.promise,
    render: () => destination(view),
    async retarget(target: NativeViewTarget, signal: AbortSignal) {
      if (retarget) {
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

export function createNavigation(
  api: MainClient,
  editors: ReturnType<typeof createWindowEditors>,
  resolve: (target: NativeViewTarget, signal: AbortSignal) => Promise<Destination>,
) {
  type OpenDialog = ReturnType<typeof openDestination>
  const [dialogs, setDialogs] = createSignal<readonly OpenDialog[]>([])
  let current: OpenDialog | undefined
  let pending: AbortController | undefined

  async function present(destination: Destination, signal: AbortSignal) {
    signal.throwIfAborted()
    const previous = current?.open() ? current : undefined
    const focus = document.activeElement
    const next = openDestination(destination, previous?.origin ?? focus)
    // Native modal dialogs escape an inert ancestor. Suspend the actual outgoing surfaces.
    const outgoing = previous
      ? Array.from(document.querySelectorAll<HTMLDialogElement>('dialog:modal:not([inert])'))
      : []
    function cancelReplacement(event: Event) {
      event.preventDefault()
      event.stopImmediatePropagation()
      next.close()
    }
    for (const dialog of outgoing) {
      dialog.inert = true
      dialog.addEventListener('cancel', cancelReplacement, true)
    }

    signal.addEventListener('abort', next.close, { once: true })
    try {
      setDialogs(previous ? [previous, next] : [next])
      if (!(await next.shown) || signal.aborted || !next.open()) {
        return false
      }
      current = next
      previous?.close()
      setDialogs([next])
      return true
    } finally {
      signal.removeEventListener('abort', next.close)
      for (const dialog of outgoing) {
        dialog.removeEventListener('cancel', cancelReplacement, true)
        dialog.inert = false
      }
      if (current !== next) {
        next.close()
        setDialogs((mounted) => mounted.filter((dialog) => dialog !== next))
        if (previous?.open() && focus instanceof HTMLElement && focus.isConnected) {
          focus.focus({ preventScroll: true })
        }
      }
    }
  }

  async function navigate(target: NativeViewTarget, signal?: AbortSignal) {
    pending?.abort()
    const request = new AbortController()
    pending = request
    const wait = signal ? AbortSignal.any([signal, request.signal]) : request.signal

    try {
      const active = current
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

      return await present(destination, wait)
    } catch (error) {
      if (wait.aborted || (error instanceof DesktopError && error.code === 'Cancelled')) {
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
    current?.close()
  })
  api.onClose((signal) => {
    pending?.abort()
    return editors.canLeave(signal)
  })
  api.onNavigate(async (raw, signal) => {
    if (!(await navigate(parseNativeViewTarget(raw), signal))) {
      throw new DesktopError('Cancelled', api.t('runtime.keepEditing'))
    }
  })

  return { dialogs, navigate }
}
