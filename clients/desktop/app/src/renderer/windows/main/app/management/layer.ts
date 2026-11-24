import { createSignal, onCleanup } from 'solid-js'
import type { NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import { waitForDecision, type EditorGuard } from '../../../../infrastructure/dialogs/closing'

export type ManagementTarget =
  | Extract<NativeViewTarget, { type: 'tasks' | 'preferences' | 'fonts' | 'themes' }>
  | { type: 'systemIntegration' }
  | { type: 'about' }

export type ResourceTarget = Extract<ManagementTarget, { type: 'themes' | 'fonts' }>

export function isManagementTarget(target: NativeViewTarget): target is ManagementTarget {
  const { type } = target
  return (
    type === 'tasks' ||
    type === 'preferences' ||
    type === 'themes' ||
    type === 'fonts' ||
    type === 'systemIntegration' ||
    type === 'about'
  )
}

type ConfirmClose = (guard?: EditorGuard, signal?: AbortSignal) => Promise<boolean>

export interface ManagementPresentation<T extends ManagementTarget> {
  target(): T
  open(): boolean

  markPresented(): void
  registerEditor(this: void, guard: EditorGuard): () => void
  requestClose(): Promise<void>
}

function createPresentation<T extends ManagementTarget>(initial: T, confirm: ConfirmClose) {
  const [target, setTarget] = createSignal<T>(() => initial)
  const [open, setOpen] = createSignal(true)
  const ready = Promise.withResolvers<boolean>()
  const lifetime = new AbortController()
  let selectionVersion = 0

  let editor: EditorGuard | undefined
  function registerEditor(guard: EditorGuard) {
    editor = guard
    return () => {
      if (editor === guard) {
        editor = undefined
      }
    }
  }

  async function canLeave(signal?: AbortSignal) {
    if (signal?.aborted || lifetime.signal.aborted) {
      return !signal?.aborted
    }

    const activeEditor = editor
    const wait = signal ? AbortSignal.any([signal, lifetime.signal]) : lifetime.signal
    const accepted = await confirm(activeEditor, wait)
    return (
      !signal?.aborted &&
      (lifetime.signal.aborted || (accepted && (!editor || editor === activeEditor)))
    )
  }

  function dismiss() {
    if (lifetime.signal.aborted) {
      return
    }
    ready.resolve(false)
    lifetime.abort()
    editor = undefined
    setOpen(false)
  }

  async function requestClose() {
    const version = selectionVersion
    if ((await canLeave()) && selectionVersion === version) {
      dismiss()
    }
  }

  function retarget(next: T) {
    selectionVersion++
    setTarget(() => next)
  }

  return {
    target,
    open,
    ended: lifetime.signal,
    presented: (signal?: AbortSignal) => waitForDecision(ready.promise, signal),
    markPresented: () => ready.resolve(true),
    editor: () => (lifetime.signal.aborted ? undefined : editor),
    registerEditor,
    canLeave,
    requestClose,
    retarget,
    dismiss,
  }
}

export function createManagementLayer<T extends ManagementTarget>(confirm: ConfirmClose) {
  const [current, setCurrent] = createSignal<ManagementPresentation<T>>()
  let instance: ReturnType<typeof createPresentation<T>> | undefined
  onCleanup(() => instance?.dismiss())

  return {
    current,
    active() {
      return instance?.ended.aborted ? undefined : instance
    },
    show(target: T) {
      instance?.dismiss()
      instance = createPresentation(target, confirm)
      setCurrent(instance)
      return instance
    },
  }
}
