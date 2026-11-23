/** @fileoverview Gives a catalog's item editor an independent native dialog and leave decision. */

import { createEffect, createMemo, onCleanup, Show } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { Dialog, DialogContent, type DialogContentProps } from '@kisaki3/desktop-ui/dialog'
import type { EditorGuard } from './closing'

/** Mounts one guarded item editor while preserving the catalog below it. */
export function EditorDialog<T>(props: {
  value: T | undefined
  size: NonNullable<DialogContentProps['size']>
  bind: (guard: EditorGuard) => () => void
  confirm: (guard: EditorGuard) => Promise<boolean>
  close: () => void
  children: (
    controls: { bind: (guard: EditorGuard) => void; cancel: () => void },
    value: T,
  ) => JSX.Element
}) {
  let guard: EditorGuard | undefined

  function bind(next: EditorGuard) {
    const entry = props.value
    guard = next

    // The draft can remain visible during exit after its close guard has been released.
    createEffect(
      () => props.value,
      (value) => {
        if (entry !== undefined && value === entry) {
          return props.bind(next)
        }
      },
    )
    onCleanup(() => {
      if (guard === next) {
        guard = undefined
      }
    })
  }

  async function cancel() {
    if (!guard || (await props.confirm(guard))) {
      props.close()
    }
  }

  function DraftContent() {
    const displayed = createMemo<T | undefined>((last) => props.value ?? last)
    return (
      <Show when={displayed()} keyed>
        {(value) => props.children({ bind, cancel: () => void cancel() }, value)}
      </Show>
    )
  }

  return (
    <Dialog
      open={props.value !== undefined}
      onOpenChange={(open) => {
        if (!open && props.value !== undefined) {
          void cancel()
        }
      }}
    >
      <DialogContent
        size={props.size}
        onCloseRequest={(event) => {
          event.preventDefault()
          void cancel()
        }}
      >
        <DraftContent />
      </DialogContent>
    </Dialog>
  )
}
