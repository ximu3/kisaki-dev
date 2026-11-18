/** @fileoverview Coordinates one cancellable close confirmation with the draft owner's save operation. */

import { createSignal, onCleanup, Show } from 'solid-js'
import {
  Dialog,
  AlertDialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogDescription,
  DialogFooter,
} from '@kisaki3/desktop-ui/dialog'
import { Button } from '@kisaki3/desktop-ui/button'
import type { Translate } from '@kisaki3/desktop-localization'

/** A business editor supplies its own save operation and reports whether it has an unsaved change. */
export interface EditorGuard {
  busy: () => boolean
  dirty: () => boolean
  save: () => Promise<boolean>
  /** Routes the keyboard shortcut to the active staged form when its scope differs from save. */
  saveShortcut?: () => Promise<boolean>
  /** Reports a temporary child editor that owns the current navigation scope. */
  hasStagedFields?: () => boolean
}

/** Presents a single confirmation even when a window and its dialog request the same close. */
export function createCloseConfirmation(t: Translate) {
  const [pending, setPending] = createSignal<{
    guard: EditorGuard
    decision: PromiseWithResolvers<boolean>
  }>()
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal('')

  function finish(close: boolean) {
    const item = pending()
    setPending(undefined)
    setError('')
    item?.decision.resolve(close)
  }
  onCleanup(() => finish(false))

  async function save() {
    const item = pending()
    if (!item) {
      return
    }
    setBusy(true)
    try {
      const accepted = await item.guard.save()
      finish(accepted && !item.guard.dirty())
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
    async ask(this: void, guard?: EditorGuard) {
      if (guard?.busy()) {
        try {
          if (!(await guard.save())) {
            return false
          }
        } catch {
          // The mounted form retains the failed save and its correction feedback.
          return false
        }
      }
      if (!guard?.dirty()) {
        return true
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
              <DialogTitle>{t('runtime.unsaved')}</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <DialogDescription>{t('runtime.unsavedDescription')}</DialogDescription>
              <Show when={error()}>
                {(message) => (
                  <p role="alert" class="mb-0 text-sm text-destructive">
                    {message()}
                  </p>
                )}
              </Show>
            </DialogBody>
            <DialogFooter>
              <Button disabled={busy()} variant="ghost" onClick={() => finish(true)}>
                {t('runtime.discard')}
              </Button>
              <Button disabled={busy()} variant="outline" onClick={() => finish(false)}>
                {t('runtime.keepEditing')}
              </Button>
              <Button autofocus disabled={busy()} onClick={() => void save()}>
                {t('actions.save')}
              </Button>
            </DialogFooter>
          </AlertDialogContent>
        </Dialog>
      )
    },
  }
}
