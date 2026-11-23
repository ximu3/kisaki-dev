import { createSignal, onCleanup } from 'solid-js'
import type { Accessor } from 'solid-js'

/** The status displayed by a toast. The operation that published it tracks its own result. */
export type ToastType = 'loading' | 'info' | 'success' | 'warning' | 'error'

/**
 * Window feedback text, status and an optional caller-owned action.
 *
 * The operation owner withdraws an action when its original target expires.
 */
export interface ToastMessage {
  type: ToastType
  message: string
  action?: {
    label: string
    /** Runs the action against the operation owner's still-valid target. */
    onClick: () => void
  }
}

/** Creation-time persistence and automatic-dismissal duration for one message. */
export interface ToastOptions {
  persistent?: boolean
  /** Display duration in milliseconds, defaulting to the Toaster's current duration. */
  durationMs?: number
}

/** Updates or dismisses a toast. After the toast ends, calls on the handle have no effect. */
export interface ToastHandle {
  /**
   * Replaces a live message and resets its display duration.
   *
   * Loading, persistence, hover and focus continue to control whether that duration advances.
   */
  update: (message: ToastMessage) => void
  /** Begins dismissal of the message without completing or cancelling its business operation. */
  dismiss: () => void
}

/** Message publication into the document's installed Toaster queue. */
export interface ToastApi {
  /** Adds an independently controlled message to the installed queue and returns its handle. */
  show: (message: ToastMessage, options?: ToastOptions) => ToastHandle
}

/** Reactive message record retained through its display and exit presentation. */
export interface ToastEntry {
  id: number

  message: Accessor<ToastMessage>
  /** Reports whether dismissal has begun and the message's actions are inert. */
  ended: Accessor<boolean>
  end: () => void

  persistent: boolean
  durationMs: number
}

/** Currently registered toast API used by imperative toast calls. */
let current: ToastApi | undefined

/** Install one Toaster in the document, then call from components, events or UI functions. */
export const toast: ToastApi = {
  /** Delegates message publication to the installed Toaster, rejecting use before a host exists. */
  show(message, options) {
    if (!current) {
      throw new Error('Install one Toaster before showing notifications.')
    }

    return current.show(message, options)
  },
}

/**
 * Creates the document's single queue under its display owner and coordinates stack mutations.
 *
 * Messages outlive publishing components. Display-owner cleanup clears the queue and publisher
 * binding.
 */
export function createToastController(
  defaultDurationMs: () => number,
  arrange: (change: () => void) => void,
) {
  if (current) {
    throw new Error('Only one Toaster may be installed in a document.')
  }

  const [entries, setEntries] = createSignal<ToastEntry[]>([])
  let nextId = 0

  // Measure the stack before removing an entry so its neighbors can animate from their previous positions.
  const release = (id: number) =>
    arrange(() => setEntries((items) => items.filter((item) => item.id !== id)))

  const api: ToastApi = {
    show(message, options = {}) {
      const id = nextId++
      const [value, replace] = createSignal(message, { equals: false })
      const [ended, setEnded] = createSignal(false)
      // Dismissal disables the handle immediately, before Solid publishes the exit state.
      let live = true
      const end = () => {
        live = false
        setEnded(true)
      }
      arrange(() =>
        setEntries((items) => [
          ...items,
          {
            id,
            message: value,
            ended,
            end,
            persistent: options.persistent ?? false,
            durationMs: options.durationMs ?? defaultDurationMs(),
          },
        ]),
      )

      return {
        dismiss: end,
        update: (next) => {
          if (live && current === api) {
            arrange(() => replace(next))
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

  return { entries, release }
}
