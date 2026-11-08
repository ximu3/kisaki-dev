/** @fileoverview One window-level notification queue, independent of the calling component. */

import { createSignal, onCleanup } from 'solid-js'
import type { Accessor } from 'solid-js'

/** Presentation type does not determine whether the underlying operation succeeded. */
export type ToastType = 'loading' | 'info' | 'success' | 'warning' | 'error'

/** The operation owner withdraws an action when its original target expires. */
export interface ToastMessage {
  type: ToastType
  message: string
  action?: { label: string; onClick: () => void }
}

/** Persistence is fixed at creation; duration is measured in milliseconds. */
export interface ToastOptions {
  persistent?: boolean
  durationMs?: number
}

/** Ended handles stay inert. Updating a living message starts its result display time. */
export interface ToastHandle {
  update: (message: ToastMessage) => void
  dismiss: () => void
}

export interface ToastApi {
  show: (message: ToastMessage, options?: ToastOptions) => ToastHandle
}

export interface ToastEntry {
  id: number

  message: Accessor<ToastMessage>
  replace: (message: ToastMessage) => void
  ended: Accessor<boolean>
  end: () => void

  persistent: boolean
  durationMs: number
}

let current: ToastApi | undefined

/** Install one Toaster in the document, then call from components, events or UI functions. */
export const toast: ToastApi = {
  show(message, options) {
    if (!current) {
      throw new Error('Install one Toaster before showing notifications.')
    }

    return current.show(message, options)
  },
}

/** The display host owns messages and timers; component disposal does not remove messages. */
export function createToastController(
  defaultDurationMs: () => number,
  arrange: (change: () => void) => void,
) {
  if (current) {
    throw new Error('Only one Toaster may be installed in a document.')
  }

  const [entries, setEntries] = createSignal<ToastEntry[]>([])
  let nextId = 0
  const dismiss = (id: number) =>
    entries()
      .find((item) => item.id === id)
      ?.end()
  const release = (id: number) =>
    arrange(() => setEntries((items) => items.filter((item) => item.id !== id)))
  const api: ToastApi = {
    show(message, options = {}) {
      const id = nextId++
      const [value, replace] = createSignal(message, { equals: false })
      const [ended, setEnded] = createSignal(false)
      arrange(() =>
        setEntries((items) => [
          ...items,
          {
            id,
            message: value,
            replace,
            ended,
            end: () => setEnded(true),
            persistent: options.persistent ?? false,
            durationMs: options.durationMs ?? defaultDurationMs(),
          },
        ]),
      )

      return {
        dismiss: () => dismiss(id),
        update: (next) => {
          const entry = entries().find((item) => item.id === id && !item.ended())
          if (entry) {
            arrange(() => entry.replace(next))
          }
        },
      }
    },
  }
  current = api
  onCleanup(() => {
    current = undefined
    setEntries([])
  })

  return { entries, dismiss, release }
}
