/** @fileoverview Gives a catalog's item editor an independent native dialog and leave decision. */

import { createEffect, createMemo, onCleanup, Show } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { Dialog, DialogContent, type DialogContentProps } from '@kisaki3/desktop-ui/dialog'
import { reportError } from '../notifications'
import type { EditorGuard } from './closing'

/** Gives the mounted editor its lifetime registration and cancel action. */
interface EditorDialogControls {
  registerEditor: (guard: EditorGuard) => void
  requestClose: () => void
}

/** Receives one opening's initial values and the catalog's close coordination. */
interface EditorDialogProps<T extends object> {
  edit: T | undefined
  size: NonNullable<DialogContentProps['size']>
  registerEditor: (guard: EditorGuard) => () => void
  confirmLeave: (guard: EditorGuard) => Promise<boolean>
  onClose: () => void
  children: (edit: T, controls: EditorDialogControls) => JSX.Element
}

/** Mounts one guarded item editor while preserving the catalog below it. */
export function EditorDialog<T extends object>(props: EditorDialogProps<T>) {
  let guard: EditorGuard | undefined

  function registerEditor(edit: T, next: EditorGuard) {
    guard = next

    // The draft can remain visible during exit after its close guard has been released.
    createEffect(
      () => props.edit,
      (value) => {
        if (value === edit) {
          return props.registerEditor(next)
        }
      },
    )
    onCleanup(() => {
      if (guard === next) {
        guard = undefined
      }
    })
  }

  async function close(edit: T) {
    const current = guard
    if (
      (!current || (await props.confirmLeave(current))) &&
      props.edit === edit &&
      guard === current
    ) {
      props.onClose()
    }
  }

  function requestClose(edit = props.edit) {
    if (edit !== undefined && edit === props.edit) {
      void close(edit).catch(reportError)
    }
  }

  function DraftContent() {
    const displayed = createMemo<T | undefined>((last) => props.edit ?? last)
    return (
      <Show when={displayed()} keyed>
        {(edit) =>
          props.children(edit, {
            registerEditor: (guard) => registerEditor(edit, guard),
            requestClose: () => requestClose(edit),
          })
        }
      </Show>
    )
  }

  return (
    <Dialog
      open={props.edit !== undefined}
      onOpenChange={(open) => {
        if (!open) {
          requestClose()
        }
      }}
    >
      <DialogContent
        size={props.size}
        onCloseRequest={(event) => {
          event.preventDefault()
          requestClose()
        }}
      >
        <DraftContent />
      </DialogContent>
    </Dialog>
  )
}
