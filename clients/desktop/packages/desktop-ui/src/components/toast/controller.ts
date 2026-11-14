/** @fileoverview Owns one document-level feedback queue independently of publishing components. */

import { createSignal, onCleanup } from 'solid-js'
import type { Accessor } from 'solid-js'

/** Message presentation status independent of the underlying operation's actual outcome. */
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

/** Control handle for a message whose updates and dismissal become inert after it ends. */
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

  /** Reads the current complete message content. */
  message: Accessor<ToastMessage>
  /** Replaces the reactive message content as one value. */
  replace: (message: ToastMessage) => void
  /** Reports whether dismissal has begun and the message's actions are inert. */
  ended: Accessor<boolean>
  /** Marks the message ended so its exit presentation can release it. */
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

  /** Reactive toast queue owned by this controller instance. */
  const [entries, setEntries] = createSignal<ToastEntry[]>([])
  let nextId = 0
  /** Begins dismissal of an existing message identified by its queue ID. */
  const dismiss = (id: number) =>
    entries()
      .find((item) => item.id === id)
      ?.end()
  /** Removes a message from the rendered stack through the layout-motion coordinator. */
  const release = (id: number) =>
    arrange(() => setEntries((items) => items.filter((item) => item.id !== id)))
  const api: ToastApi = {
    /** Appends an independent reactive message and returns handles bound to that queue entry. */
    show(message, options = {}) {
      const id = nextId++
      /** Live message value observed by a toast handle and its rendered entry. */
      const [value, replace] = createSignal(message, { equals: false })
      /** Terminal state preventing an ended toast handle from becoming active again. */
      const [ended, setEnded] = createSignal(false)
      arrange(() =>
        setEntries((items) => [
          ...items,
          {
            id,
            message: value,
            replace,
            ended,
            /** Marks this queue entry ended. */
            end: () => setEnded(true),
            persistent: options.persistent ?? false,
            durationMs: options.durationMs ?? defaultDurationMs(),
          },
        ]),
      )

      return {
        /** Requests dismissal of this entry by its stable queue ID. */
        dismiss: () => dismiss(id),
        /**
         * Replaces this entry's content through stack coordination while the entry remains live.
         */
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
