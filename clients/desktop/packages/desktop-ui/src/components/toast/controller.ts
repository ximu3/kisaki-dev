/** @fileoverview Local toast messages are bound to the Solid owner that obtains their handle. */

import { createContext, createSignal, getOwner, onCleanup, useContext } from 'solid-js'
import type { Accessor } from 'solid-js'

/** Presentation type does not determine whether the underlying operation succeeded. */
export type ToastType = 'loading' | 'info' | 'success' | 'warning' | 'error'

/** A local action retains its original target; its owner removes it when that target expires. */
export interface ToastMessage {
  type: ToastType
  message: string
  action?: { label: string; onClick: () => void }
}

/** Persistence is fixed at creation and survives message replacement; duration is milliseconds. */
export interface ToastOptions {
  persistent?: boolean
  durationMs?: number
}

/** Ended handles are inert; update replaces a living message and starts its result display time. */
export interface ToastHandle {
  update: (message: ToastMessage) => void
  dismiss: () => void
}

/** Acquire during component setup, then use the same instance in events and asynchronous operations. */
export interface ToastApi {
  show: (message: ToastMessage, options?: ToastOptions) => ToastHandle
}

export interface ToastEntry {
  id: number
  owner: symbol

  message: Accessor<ToastMessage>
  replace: (message: ToastMessage) => void

  persistent: boolean
  durationMs: number
}

/** Provider-local storage; child owner cleanup and provider cleanup share the same removal path. */
export function createToastController(defaultDurationMs: () => number) {
  const [entries, setEntries] = createSignal<ToastEntry[]>([])
  let nextId = 0
  let alive = true
  const dismiss = (id: number) => setEntries((items) => items.filter((item) => item.id !== id))
  onCleanup(() => {
    alive = false
    setEntries([])
  })

  return {
    entries,
    dismiss,
    bind(): ToastApi {
      const owner = Symbol()
      let active = true
      onCleanup(() => {
        active = false
        setEntries((items) => items.filter((item) => item.owner !== owner))
      })

      return {
        show(message, options = {}) {
          const id = nextId++
          if (alive && active) {
            const [current, replace] = createSignal(message, { equals: false })
            setEntries((items) => [
              ...items,
              {
                id,
                owner,
                message: current,
                replace,
                persistent: options.persistent ?? false,
                durationMs: options.durationMs ?? defaultDurationMs(),
              },
            ])
          }

          return {
            dismiss: () => {
              dismiss(id)
            },
            update: (message) => {
              if (!alive || !active) {
                return
              }

              entries()
                .find((item) => item.id === id)
                ?.replace(message)
            },
          }
        },
      }
    },
  }
}

export const ToastContext = createContext<ReturnType<typeof createToastController>>()

/** Bind messages to the current Solid owner. Late results after its disposal cannot create new messages. */
export function useToast(): ToastApi {
  const controller = useContext(ToastContext)
  if (!controller || !getOwner()) {
    throw new Error('useToast requires a Solid owner inside ToastProvider.')
  }

  return controller.bind()
}
