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

export interface EditorGuard {
  pending: () => Promise<boolean> | undefined
  dirty: () => boolean
  save: () => Promise<boolean>

  currentFormAction?: () => (() => Promise<boolean>) | undefined
}

export async function waitForDecision(action: Promise<boolean>, signal?: AbortSignal) {
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

export function createCloseConfirmation(t: Translate, reveal: () => Promise<void>) {
  let pending:
    | {
        guard: EditorGuard
        waiters: number
        decision: PromiseWithResolvers<boolean>
        reveal: Promise<void>
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
    active: () => !!pending,
    async ask(this: void, guard?: EditorGuard, signal?: AbortSignal) {
      if (signal?.aborted) {
        return false
      }
      if (!guard) {
        return true
      }

      const operation = pending ? undefined : guard.pending()
      if (operation) {
        try {
          if (!(await waitForDecision(operation, signal))) {
            return false
          }
        } catch {
          return false
        }
      }

      const current = pending
      if (signal?.aborted || (current && current.guard !== guard)) {
        return false
      }
      if (!current && !guard.dirty()) {
        return true
      }

      const item = current ?? {
        guard,
        decision: Promise.withResolvers<boolean>(),
        reveal: Promise.resolve().then(reveal),
        waiters: 0,
      }
      item.waiters++
      if (!current) {
        pending = item
        setPresent(true)
      }

      try {
        const response = item.reveal.then(() => item.decision.promise)
        return await waitForDecision(response, signal)
      } finally {
        item.waiters--
        if (item.waiters === 0 && pending === item) {
          finish(false)
        }
      }
    },
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
              <DialogTitle>{t('forms.unsaved.title')}</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <DialogDescription>{t('forms.unsaved.description')}</DialogDescription>
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
                {t('forms.unsaved.discard')}
              </Button>
              <Button disabled={busy()} variant="outline" onClick={() => finish(false)}>
                {t('forms.unsaved.keepEditing')}
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
