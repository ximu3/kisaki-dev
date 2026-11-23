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
}

/** Cancels one request for a decision while allowing independent callers or a save to finish. */
async function waitForDecision(action: Promise<boolean>, signal?: AbortSignal) {
  if (!signal) {
    return action
  }
  if (signal.aborted) {
    return false
  }
  const cancelled = Promise.withResolvers<boolean>()
  const stop = () => cancelled.resolve(false)
  signal.addEventListener('abort', stop, { once: true })
  try {
    return await Promise.race([action, cancelled.promise])
  } finally {
    signal.removeEventListener('abort', stop)
  }
}

/** Presents a single confirmation even when a window and its dialog request the same close. */
export function createCloseConfirmation(t: Translate, reveal: () => Promise<void>) {
  let pending:
    | {
        guard: EditorGuard
        waiters: number
        decision: PromiseWithResolvers<boolean>
      }
    | undefined
  const [present, setPresent] = createSignal(false)
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal('')

  function finish(close: boolean) {
    const item = pending
    pending = undefined
    setPresent(false)
    setBusy(false)
    setError('')
    item?.decision.resolve(close)
  }
  onCleanup(() => finish(false))

  async function save() {
    const item = pending
    if (!item) {
      return
    }
    // Return native focus to the editor before its form validates and locates a field.
    setBusy(true)
    try {
      const accepted = await item.guard.save()
      if (pending === item) {
        finish(accepted && !item.guard.dirty())
      }
    } catch (cause) {
      if (pending === item) {
        setError(cause instanceof Error ? cause.message : String(cause))
      }
    } finally {
      if (pending === item) {
        setBusy(false)
      }
    }
  }
  return {
    /** Reports whether the confirmation owns the active keyboard scope. */
    active: () => !!pending,
    /** Returns immediately for clean editors and coalesces a repeated request for the current draft. */
    async ask(this: void, guard?: EditorGuard, signal?: AbortSignal) {
      if (signal?.aborted) {
        return false
      }
      if (guard?.busy()) {
        try {
          if (!(await waitForDecision(guard.save(), signal))) {
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
      const item = pending ?? { guard, decision: Promise.withResolvers<boolean>(), waiters: 0 }
      item.waiters++
      pending = item
      setPresent(true)
      try {
        const response = reveal().then(() => item.decision.promise)
        return await waitForDecision(response, signal)
      } finally {
        item.waiters--
        if (item.waiters === 0 && pending === item) {
          finish(false)
        }
      }
    },
    /** Renders the native confirmation at the top of the window's existing modal stack. */
    Content(this: void) {
      return (
        <Dialog
          open={present() && !busy()}
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
