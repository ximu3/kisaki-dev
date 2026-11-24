import { createEffect, createMemo, onCleanup, Show, useContext } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { Dialog, DialogContent, type DialogContentProps } from '@kisaki3/desktop-ui/dialog'
import { reportError } from '../notifications'
import type { EditorGuard } from './closing'
import { WindowEditors } from './editors'

interface EditorDialogControls {
  registerEditor: (guard: EditorGuard) => void
  requestClose: () => void
}

interface EditorDialogProps<T extends object> {
  edit: T | undefined
  size: NonNullable<DialogContentProps['size']>
  onClose: () => void
  children: (edit: T, controls: EditorDialogControls) => JSX.Element
}

export function EditorDialog<T extends object>(props: EditorDialogProps<T>) {
  const editors = useContext(WindowEditors)!
  const lifetime = new AbortController()
  onCleanup(() => lifetime.abort())
  let dialog: HTMLDialogElement
  let guard: EditorGuard | undefined

  function registerEditor(edit: T, next: EditorGuard) {
    guard = next

    // The draft can remain visible during exit after its close guard has been released.
    createEffect(
      () => props.edit,
      (value) => {
        if (value === edit) {
          return editors.register(next, () => dialog)
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
      (!current || (await editors.confirm(current, lifetime.signal))) &&
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
        ref={(node) => {
          dialog = node
        }}
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
