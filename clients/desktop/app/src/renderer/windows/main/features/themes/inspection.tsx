import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { createMemo, createSignal, Show } from 'solid-js'
import { createQuery } from '../../../../infrastructure/query'
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
  const theme = createQuery({
    prepare() {
      const target = props.target
      return (signal) => api.request(signal, 'themes.get', target)
    },
  })
  deferDialogUntil(() => !theme.pending)

  observeDialogTarget(props.receipt, () => ({
    presented: props.visible && !theme.pending && !!theme.value,
    error:
      theme.error ??
      (theme.value === null && !theme.pending
        ? new DesktopError('NotFound', api.t('runtime.unavailable'))
        : undefined),
  }))

  return (
    <>
      <DialogHeader closeLabel={api.t('actions.close')}>
        <DialogTitle>{props.name ?? api.t('runtime.themePreview')}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <QueryError
          error={theme.error}
          retryLabel={api.t('runtime.retry')}
          retry={() => void theme.reload()}
        />
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
