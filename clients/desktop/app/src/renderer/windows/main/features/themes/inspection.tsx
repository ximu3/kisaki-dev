import { createMemo, Show } from 'solid-js'
import { createQuery } from '../../../../infrastructure/query'
import type { ThemeRef } from '@kisaki3/desktop-contracts/appearance'
import { Alert } from '@kisaki3/desktop-ui/alert'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogHeader,
  DialogTitle,
  deferDialogUntil,
} from '@kisaki3/desktop-ui/dialog'
import { Spinner } from '@kisaki3/desktop-ui/spinner'
import type { MainClient } from '../../../../infrastructure/api'
import { errorMessage } from '../../../../infrastructure/notifications'
import { ThemeSamples } from './samples'

/** Reads a theme when the user opens its read-only preview. */
export function ThemeInspection(props: {
  api: MainClient
  target: ThemeRef | undefined
  name: string | undefined
  close: () => void
}) {
  const displayed = createMemo<ThemeRef | undefined>((last) => props.target ?? last)
  const name = createMemo<string | undefined>((last) => (props.target ? props.name : last))

  return (
    <Dialog
      open={!!props.target}
      onOpenChange={(open) => {
        if (!open) {
          props.close()
        }
      }}
    >
      <DialogContent>
        <Show when={displayed()} keyed>
          {(ref) => <ThemePreview api={props.api} target={ref} name={name()} />}
        </Show>
      </DialogContent>
    </Dialog>
  )
}

/** Preserves the last displayed palette through the dialog's exit. */
function ThemePreview(props: { api: MainClient; target: ThemeRef; name?: string | undefined }) {
  const { api } = props
  const theme = createQuery({
    prepare() {
      const target = props.target
      return (signal) => api.request(signal, 'themes.get', target)
    },
  })
  deferDialogUntil(() => !theme.pending)

  return (
    <>
      <DialogHeader closeLabel={api.t('actions.close')}>
        <DialogTitle>{props.name ?? api.t('runtime.themePreview')}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <Show when={theme.error}>
          {(cause) => (
            <Alert tone="destructive" role="alert">
              {errorMessage(cause())}{' '}
              <Button variant="outline" onClick={() => void theme.reload()}>
                {api.t('runtime.retry')}
              </Button>
            </Alert>
          )}
        </Show>
        <Show when={!theme.error}>
          <Show when={!theme.pending} fallback={<Spinner label={api.t('runtime.loading')} />}>
            <Show
              when={theme.value}
              fallback={<p class="m-0 text-sm">{api.t('runtime.unavailable')}</p>}
            >
              {(value) => <ThemeSamples theme={value()} t={api.t} />}
            </Show>
          </Show>
        </Show>
      </DialogBody>
    </>
  )
}
