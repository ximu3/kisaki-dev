/** @fileoverview Owns each management dialog's target, presentation and active editor registration. */

import { createSignal, onCleanup } from 'solid-js'
import type { NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import { waitForDecision, type EditorGuard } from '../../../../infrastructure/dialogs/closing'

/** Native destinations presented by the main window's management tools. */
export type ManagementTarget =
  | Extract<NativeViewTarget, { type: 'tasks' | 'preferences' | 'fonts' | 'themes' }>
  | { type: 'systemIntegration' }
  | { type: 'about' }

/** Independent catalogs that can open above the preference editor. */
export type ResourceTarget = Extract<ManagementTarget, { type: 'themes' | 'fonts' }>

/** Identifies the native destinations presented above the main window's page. */
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

/** An editor decision shared by the document's management presentations. */
type ConfirmClose = (guard?: EditorGuard, signal?: AbortSignal) => Promise<boolean>

/** The host's view of one management dialog, retained through its exit transition. */
export interface ManagementPresentation<T extends ManagementTarget> {
  target(): T
  open(): boolean

  /** Acknowledges that the dialog entered the native modal layer. */
  markPresented(): void
  /** Binds the active editor and returns its matching unregister operation. */
  registerEditor(this: void, guard: EditorGuard): () => void
  /** Requests and applies a close to this presentation and its current target. */
  requestClose(): Promise<void>
}

/** Makes one presentation whose callbacks cannot act on a replacement. */
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

/** Retains a departing presentation for its exit transition until another is requested. */
export function createManagementLayer<T extends ManagementTarget>(confirm: ConfirmClose) {
  const [current, setCurrent] = createSignal<ManagementPresentation<T>>()
  let instance: ReturnType<typeof createPresentation<T>> | undefined
  onCleanup(() => instance?.dismiss())

  return {
    /** Reads the presented instance reactively, including throughout its exit transition. */
    current,
    /** Reads the active instance for commands, including before Solid flushes a new presentation. */
    active() {
      return instance?.ended.aborted ? undefined : instance
    },
    /** Withdraws the old presentation and returns the new instance before its first frame. */
    show(target: T) {
      instance?.dismiss()
      instance = createPresentation(target, confirm)
      setCurrent(instance)
      return instance
    },
  }
}
