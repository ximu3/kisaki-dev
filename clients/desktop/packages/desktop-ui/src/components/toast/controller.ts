import { createSignal, onCleanup, type Accessor } from 'solid-js'

export type ToastType = 'loading' | 'info' | 'success' | 'warning' | 'error'

export interface ToastMessage {
  type: ToastType
  message: string
  action?: {
    label: string
    onClick: () => void
  }
}

export interface ToastOptions {
  persistent?: boolean
  durationMs?: number
}

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
  ended: Accessor<boolean>
  end: () => void

  persistent: boolean
  durationMs: number
}

let current: ToastApi | undefined

export const toast: ToastApi = {
  show(message, options) {
    if (!current) {
      throw new Error('Install one Toaster before showing notifications.')
    }

    return current.show(message, options)
  },
}

export function createToastController(
  defaultDurationMs: () => number,
  arrange: (change: () => void) => void,
) {
  if (current) {
    throw new Error('Only one Toaster may be installed in a document.')
  }

  const [entries, setEntries] = createSignal<ToastEntry[]>([])
  let nextId = 0

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
