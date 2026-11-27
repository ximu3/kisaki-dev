import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { createMemo, createSignal, Show } from 'solid-js'
import { createViewQuery } from '../../../../infrastructure/query'
import type { ThemeRef } from '@kisaki3/desktop-contracts/appearance'
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogHeader,
  DialogTitle,
  deferDialogUntil,
} from '@kisaki3/desktop-ui/dialog'
import { Spinner } from '@kisaki3/desktop-ui/spinner'
import {
  observeDialogTarget,
  type DialogReceipt,
} from '../../../../infrastructure/dialogs/presentation'
import type { MainClient } from '../../../../infrastructure/api'
import { ThemeSamples } from './samples'
import { QueryError } from '../../../../infrastructure/query/error'

export function ThemeInspection(props: {
  api: MainClient
  target: ThemeRef | undefined
  name: string | undefined
  close: () => void
  receipt: DialogReceipt | undefined
}) {
  const [visible, setVisible] = createSignal(false)
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
      <DialogContent onToggle={(event) => setVisible(event.currentTarget.open)}>
        <Show when={displayed()} keyed>
          {(ref) => (
            <ThemePreview
              api={props.api}
              target={ref}
              name={name()}
              receipt={props.receipt}
              visible={visible()}
            />
          )}
        </Show>
      </DialogContent>
    </Dialog>
  )
}

function ThemePreview(props: {
  api: MainClient
  target: ThemeRef
  name?: string | undefined
  receipt: DialogReceipt | undefined
  visible: boolean
}) {
  const { api } = props
  const theme = createViewQuery((signal) => api.request(signal, 'themes.get', props.target))
  deferDialogUntil(() => !theme.pending())

  observeDialogTarget(props.receipt, () => ({
    presented: props.visible && !theme.pending() && !!theme.result()?.value,
    error:
      theme.result()?.error ??
      (theme.result()?.value === null && !theme.pending()
        ? new DesktopError('NotFound', api.t('controls.feedback.unavailable'))
        : undefined),
  }))

  return (
    <>
      <DialogHeader closeLabel={api.t('actions.close')}>
        <DialogTitle>{props.name ?? api.t('themes.preview.title')}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <QueryError
          error={theme.result()?.error}
          retryLabel={api.t('actions.retry')}
          retry={() => void theme.reload()}
        />
        <Show when={!theme.result()?.error}>
          <Show
            when={!theme.pending()}
            fallback={<Spinner label={api.t('controls.feedback.loading')} />}
          >
            <Show
              when={theme.result()?.value}
              fallback={<p class="m-0 text-sm">{api.t('controls.feedback.unavailable')}</p>}
            >
              {(value) => <ThemeSamples theme={value()} t={api.t} />}
            </Show>
          </Show>
        </Show>
      </DialogBody>
    </>
  )
}
