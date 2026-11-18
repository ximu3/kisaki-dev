/** @fileoverview Presents one explicit destructive decision in the initiating dialog's scope. */

import { createMemo, createSignal, onCleanup, Show } from 'solid-js'
import {
  AlertDialogContent,
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kisaki3/desktop-ui/dialog'
import { Button } from '@kisaki3/desktop-ui/button'
import type { Translate } from '@kisaki3/desktop-localization'

/** Asks about a named action and resolves false when its owner or dialog closes. */
export function createConfirmation(t: Translate) {
  const [pending, setPending] = createSignal<{
    title: string
    action: string
    description: string
    decision: PromiseWithResolvers<boolean>
  }>()

  function finish(accepted: boolean) {
    const current = pending()
    setPending(undefined)
    current?.decision.resolve(accepted)
  }
  onCleanup(() => finish(false))

  function ask(title: string, action: string, description: string) {
    const current = pending()
    if (current) {
      return current.decision.promise
    }
    const decision = Promise.withResolvers<boolean>()
    setPending({ title, action, description, decision })
    return decision.promise
  }

  function Content() {
    const displayed = createMemo<
      { title: string; action: string; description: string } | undefined
    >((last) => {
      const value = pending()
      return value
        ? { title: value.title, action: value.action, description: value.description }
        : last
    }, undefined)

    return (
      <Dialog
        open={!!pending()}
        onOpenChange={(open) => {
          if (!open) {
            finish(false)
          }
        }}
      >
        <AlertDialogContent>
          <DialogHeader>
            <DialogTitle>{displayed()?.title}</DialogTitle>
          </DialogHeader>
          <Show when={displayed()?.description}>
            {(description) => (
              <DialogBody>
                <DialogDescription>{description()}</DialogDescription>
              </DialogBody>
            )}
          </Show>
          <DialogFooter>
            <Button autofocus variant="ghost" onClick={() => finish(false)}>
              {t('actions.cancel')}
            </Button>
            <Button variant="destructive" onClick={() => finish(true)}>
              {displayed()?.action}
            </Button>
          </DialogFooter>
        </AlertDialogContent>
      </Dialog>
    )
  }

  return { ask, Content }
}
