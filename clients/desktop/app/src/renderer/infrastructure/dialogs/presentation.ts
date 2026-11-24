import { createSignal, onCleanup, useContext } from 'solid-js'
import { reportError } from '../notifications'
import { WindowEditors } from './editors'
import type { NativeViewTarget } from '@kisaki3/desktop-contracts/ui'

export interface DialogPresentation {
  open: () => boolean
  close: () => void
  presented?: () => void
}

export interface NavigableDialog extends DialogPresentation {
  presented: () => void
  failed: (error: unknown) => void
  onNavigate: (handler: (target: NativeViewTarget, signal: AbortSignal) => Promise<boolean>) => void
}

export function createLocalDialog<T>(load: () => Promise<T>, ownerOpen: () => boolean) {
  const [component, setComponent] = createSignal<T>()
  const [open, setOpen] = createSignal(false)
  let disposed = false
  onCleanup(() => {
    disposed = true
  })

  async function show() {
    try {
      const loaded = component() ?? (await load())
      if (!disposed && ownerOpen()) {
        setComponent(() => loaded)
        setOpen(true)
      }
    } catch (error) {
      if (!disposed && ownerOpen()) {
        reportError(error)
      }
    }
  }

  return {
    component,
    show: () => void show(),
    view: { open, close: () => setOpen(false) },
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
