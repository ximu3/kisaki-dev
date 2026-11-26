import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { createEffect, createSignal, getOwner, isDisposed, onCleanup, useContext } from 'solid-js'
import { reportError } from '../notifications'
import { WindowEditors } from './editors'
import type { NativeViewTarget } from '@kisaki3/desktop-contracts/ui'

export interface DialogReceipt {
  presented: () => void
  failed: (error: unknown) => void
}

export interface DialogPresentation {
  open: () => boolean
  close: () => void
  receipt?: DialogReceipt
}

export interface NavigableDialog extends DialogPresentation {
  receipt: DialogReceipt
  onNavigate: (handler: (target: NativeViewTarget, signal: AbortSignal) => Promise<boolean>) => void
}

export function observeDialogTarget(
  receipt: DialogReceipt | undefined,
  read: () => { presented: boolean; error: unknown },
) {
  if (!receipt) {
    return
  }
  let waiting = true
  createEffect(read, ({ presented, error }) => {
    if (waiting && (presented || error !== undefined)) {
      waiting = false
      if (error !== undefined) {
        receipt.failed(error)
      } else {
        receipt.presented()
      }
    }
  })
  onCleanup(() => {
    if (waiting) {
      receipt.failed(new DesktopError('Cancelled', 'The requested detail was closed'))
    }
  })
}

export function createLocalDialog(preload: () => Promise<unknown>, ownerOpen: () => boolean) {
  const [open, setOpen] = createSignal<boolean>()
  const owner = getOwner()!

  async function show() {
    try {
      await preload()
      if (!isDisposed(owner) && ownerOpen()) {
        setOpen(true)
      }
    } catch (error) {
      if (!isDisposed(owner) && ownerOpen()) {
        reportError(error)
      }
    }
  }

  return {
    mounted: () => open() !== undefined,
    show: () => void show(),
    view: { open: () => open() === true, close: () => setOpen(false) },
  }
}

export function useDialogClose(view: DialogPresentation) {
  const editors = useContext(WindowEditors)!
  const lifetime = new AbortController()
  onCleanup(() => lifetime.abort())
  let dialog: HTMLDialogElement

  async function close() {
    if (view.open() && (await editors.canLeave(lifetime.signal, dialog))) {
      view.close()
    }
  }

  return {
    node: () => dialog,
    ref: (node: HTMLDialogElement) => {
      dialog = node
    },
    onOpenChange: (open: boolean) => {
      if (!open) {
        void close().catch(reportError)
      }
    },
    onCloseRequest: (event: Event) => {
      event.preventDefault()
      void close().catch(reportError)
    },
  }
}
