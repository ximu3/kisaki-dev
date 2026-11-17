/** @fileoverview Coordinates one cancellable close confirmation with the draft owner's save operation. */

import { createSignal, onCleanup, Show } from 'solid-js'
import {
  Dialog,
  AlertDialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@kisaki3/desktop-ui/dialog'
import { Button } from '@kisaki3/desktop-ui/button'
import type { MainClient } from './api'

/** A business editor supplies its own save operation and reports whether it has an unsaved change. */
export interface EditorGuard {
  dirty: boolean
  save: () => Promise<void>
}

/** Presents a single confirmation even when a window and its dialog request the same close. */
export function createCloseConfirmation(api: MainClient) {
  /** Holds the one close decision currently awaiting the user. */
  const [pending, setPending] = createSignal<{
    guard: EditorGuard
    decision: PromiseWithResolvers<boolean>
  }>()
  /** Disables a second decision while the editor commits its save. */
  const [busy, setBusy] = createSignal(false)
  /** Displays a failed save in the confirmation that requested it. */
  const [error, setError] = createSignal('')
  /** Completes the choice and returns focus to the editor if the user wants to continue. */
  function finish(close: boolean) {
    const item = pending()
    setPending(undefined)
    setError('')
    item?.decision.resolve(close)
  }
  onCleanup(() => finish(false))
  /** Gives the editor ownership of validation, persistence and any failure message. */
  async function save() {
    const item = pending()
    if (!item) {
      return
    }
    setBusy(true)
    try {
      await item.guard.save()
      finish(!item.guard.dirty)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }
  return {
    /** Reports whether the confirmation owns the active keyboard scope. */
    active: () => !!pending(),
    /** Returns immediately for clean editors and coalesces a repeated request for the current draft. */
    ask(guard: EditorGuard) {
      if (!guard.dirty) {
        return Promise.resolve(true)
      }
      const existing = pending()
      if (existing) {
        return existing.decision.promise
      }
      const decision = Promise.withResolvers<boolean>()
      setPending({ guard, decision })
      return decision.promise
    },
    /** Renders the native confirmation at the top of the window's existing modal stack. */
    Content(this: void) {
      return (
        <Dialog
          open={!!pending()}
          onOpenChange={(value) => {
            if (!value && !busy()) {
              finish(false)
            }
          }}
        >
          <AlertDialogContent
            onCloseRequest={(event) => {
              event.preventDefault()
              if (!busy()) {
                finish(false)
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>{api.t('runtime.unsaved')}</DialogTitle>
            </DialogHeader>
            <Show when={error()}>
              <DialogBody>
                <p role="alert">{error()}</p>
              </DialogBody>
            </Show>
            <DialogFooter>
              <Button disabled={busy()} variant="ghost" onClick={() => finish(false)}>
                {api.t('runtime.keepEditing')}
              </Button>
              <Button disabled={busy()} variant="outline" onClick={() => finish(true)}>
                {api.t('runtime.discard')}
              </Button>
              <Button disabled={busy()} onClick={() => void save()}>
                {api.t('actions.save')}
              </Button>
            </DialogFooter>
          </AlertDialogContent>
        </Dialog>
      )
    },
  }
}
