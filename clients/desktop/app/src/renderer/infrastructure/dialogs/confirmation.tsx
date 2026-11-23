import { createSignal, onCleanup, Show } from 'solid-js'
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
  let decision: PromiseWithResolvers<boolean> | undefined
  const [prompt, setPrompt] = createSignal<{ title: string; action: string; description: string }>()
  const [open, setOpen] = createSignal(false)

  function finish(accepted: boolean) {
    const current = decision
    decision = undefined
    setOpen(false)
    current?.resolve(accepted)
  }
  onCleanup(() => finish(false))

  function ask(title: string, action: string, description: string) {
    if (!decision) {
      decision = Promise.withResolvers<boolean>()
      setPrompt({ title, action, description })
      setOpen(true)
    }
    return decision.promise
  }

  function Content() {
    return (
      <Dialog
        open={open()}
        onOpenChange={(open) => {
          if (!open) {
            finish(false)
          }
        }}
      >
        <AlertDialogContent>
          <DialogHeader>
            <DialogTitle>{prompt()?.title}</DialogTitle>
          </DialogHeader>
          <Show when={prompt()?.description}>
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
              {prompt()?.action}
            </Button>
          </DialogFooter>
        </AlertDialogContent>
      </Dialog>
    )
  }

  return { ask, Content }
}
