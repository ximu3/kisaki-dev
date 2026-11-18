/** @fileoverview Inspects an installed theme's actual light and dark palettes. */

import { createMemo, createResource, Show } from 'solid-js'
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
  const displayed = createMemo<ThemeRef | undefined>((last) => props.target ?? last, undefined)
  const name = createMemo<string | undefined>(
    (last) => (props.target ? props.name : last),
    undefined,
  )

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
  const [theme, { refetch }] = createResource(() => api.call('themes.get', props.target))
  deferDialogUntil(() => theme.state === 'ready' || theme.state === 'errored')

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
              <Button variant="outline" onClick={() => void refetch()}>
                {api.t('runtime.retry')}
              </Button>
            </Alert>
          )}
        </Show>
        <Show when={!theme.error}>
          <Show when={!theme.loading} fallback={<Spinner label={api.t('runtime.loading')} />}>
            <Show
              when={theme()}
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
