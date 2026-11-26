import { Show } from 'solid-js'
import { createQuery } from '../../../infrastructure/query'
import { mdiContentCopy } from '@mdi/js'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  deferDialogUntil,
} from '@kisaki3/desktop-ui/dialog'
import { Spinner } from '@kisaki3/desktop-ui/spinner'
import { toast } from '@kisaki3/desktop-ui/toast'
import type { MainClient } from '../../../infrastructure/api'
import {
  useDialogClose,
  type DialogPresentation,
} from '../../../infrastructure/dialogs/presentation'
import { QueryError } from '../../../infrastructure/query/error'

interface AboutProps {
  api: MainClient
  report: (error: unknown) => void
  view: DialogPresentation
}

export function About(props: AboutProps) {
  const close = useDialogClose(props.view)

  return (
    <Dialog open={props.view.open()} onOpenChange={close.onOpenChange}>
      <DialogContent
        ref={close.ref}
        size="md"
        onCloseRequest={close.onCloseRequest}
        onToggle={(event) => {
          if (event.currentTarget.open) {
            props.view.presented?.()
          }
        }}
      >
        <AboutContent {...props} />
      </DialogContent>
    </Dialog>
  )
}

function AboutContent(props: AboutProps) {
  const { api } = props
  const info = createQuery((signal) => api.request(signal, 'app.environment'))
  deferDialogUntil(() => !!info.error || !!info.value)

  async function copy() {
    await api.call('app.copyEnvironment')
    toast.show({ type: 'success', message: api.t('runtime.copied') })
  }

  return (
    <>
      <DialogHeader closeLabel={api.t('actions.close')}>
        <DialogTitle>{api.t('runtime.about')}</DialogTitle>
      </DialogHeader>
      <DialogBody class="flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <img src="kisaki-app://window/brand/icon.png" alt="" class="size-11 rounded-md" />
          <div>
            <h3 class="m-0 text-lg font-semibold">{api.applicationName}</h3>
            <p class="m-0 text-xs text-muted-foreground">AGPL-3.0-only</p>
          </div>
        </div>

        <QueryError
          error={info.error}
          retryLabel={api.t('runtime.retry')}
          retry={() => void info.reload()}
        />
        <Show
          when={!info.error && info.value}
          fallback={!info.error && <Spinner label={api.t('runtime.loading')} />}
        >
          {(value) => (
            <dl class="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
              <dt class="text-muted-foreground">{api.t('runtime.appVersion')}</dt>
              <dd class="m-0 break-words">{value().version}</dd>
              <dt class="text-muted-foreground">{api.t('runtime.operatingSystem')}</dt>
              <dd class="m-0 break-words">
                {value().operatingSystem.name} {value().operatingSystem.version}
              </dd>
              <dt class="text-muted-foreground">{api.t('runtime.architecture')}</dt>
              <dd class="m-0">{value().architecture}</dd>
            </dl>
          )}
        </Show>
      </DialogBody>
      <DialogFooter>
        <Button
          variant="outline"
          disabled={!!info.error || info.pending}
          onClick={() => void copy().catch(props.report)}
        >
          <Icon path={mdiContentCopy} />
          {api.t('runtime.copyEnvironment')}
        </Button>
      </DialogFooter>
    </>
  )
}
