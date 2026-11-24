import { createMemo, Show } from 'solid-js'
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
import type { MainClient } from '../../../../infrastructure/api'
import { ThemeSamples } from './samples'
import { QueryError } from '../../../../infrastructure/query/error'

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
