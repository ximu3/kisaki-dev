import { createContext } from 'solid-js'
import type { EditorGuard } from './closing'

export function createWindowEditors(
  confirm: (guard: EditorGuard, signal?: AbortSignal) => Promise<boolean>,
) {
  const editors = new Set<{
    guard: EditorGuard
    dialog: () => HTMLDialogElement | undefined
    ownsFocus: (() => boolean) | undefined
  }>()

  function register(
    guard: EditorGuard,
    dialog: () => HTMLDialogElement | undefined,
    ownsFocus?: () => boolean,
  ) {
    const editor = { guard, dialog, ownsFocus }
    editors.add(editor)
    return () => {
      editors.delete(editor)
    }
  }

  async function canLeave(signal?: AbortSignal, within?: HTMLDialogElement) {
    const current = () =>
      [...editors].filter(({ dialog }) => {
        const node = dialog()
        return node?.open && (!within || within.contains(node))
      })
    const leaving = current().reverse()
    for (const editor of leaving) {
      if (editors.has(editor) && !(await confirm(editor.guard, signal))) {
        return false
      }
    }
    return !signal?.aborted && current().every((editor) => leaving.includes(editor))
  }

  function focused() {
    const modal = document.activeElement?.closest('dialog')
    return [...editors].reverse().find(({ dialog, ownsFocus }) => {
      const node = dialog()
      return ownsFocus?.() || (!!node && node === modal)
    })?.guard
  }

  return { register, canLeave, focused, confirm }
}

export const WindowEditors = createContext<ReturnType<typeof createWindowEditors>>()
