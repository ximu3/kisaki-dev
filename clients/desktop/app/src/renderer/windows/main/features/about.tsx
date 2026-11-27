import { createMemo, Errored, Loading, type ParentProps } from 'solid-js'
import { requestSignal } from '../../../infrastructure/query'
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
import { reportError } from '../../../infrastructure/notifications'
import type { MainClient } from '../../../infrastructure/api'
import {
  useDialogClose,
  type DialogPresentation,
} from '../../../infrastructure/dialogs/presentation'
import { QueryError } from '../../../infrastructure/query/error'

interface AboutProps {
  api: MainClient
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
            props.view.receipt?.presented()
          }
        }}
      >
        <AboutContent api={props.api} />
      </DialogContent>
    </Dialog>
  )
}

function AboutContent(props: { api: MainClient }) {
  const { api } = props
  const info = createMemo(() => api.request(requestSignal(), 'app.environment'))

  function Waiting() {
    deferDialogUntil(() => false)
    return (
      <Layout>
        <Spinner label={api.t('controls.feedback.loading')} />
      </Layout>
    )
  }

  function Layout(props: ParentProps<{ ready?: boolean }>) {
    async function copy() {
      await api.call('app.copyEnvironment')
      toast.show({ type: 'success', message: api.t('controls.feedback.copied') })
    }

    return (
      <>
        <DialogHeader closeLabel={api.t('actions.close')}>
          <DialogTitle>{api.t('application.about.title')}</DialogTitle>
        </DialogHeader>
        <DialogBody class="flex flex-col gap-4">
          <div class="flex items-center gap-3">
            <img src="kisaki-app://window/brand/icon.png" alt="" class="size-11 rounded-md" />
            <div>
              <h3 class="m-0 text-lg font-semibold">{api.applicationName}</h3>
              <p class="m-0 text-xs text-muted-foreground">AGPL-3.0-only</p>
            </div>
          </div>

          {props.children}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={!props.ready}
            onClick={() => void copy().catch(reportError)}
          >
            <Icon path={mdiContentCopy} />
            {api.t('application.about.copyEnvironment')}
          </Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <Errored
      fallback={(error, retry) => (
        <Layout>
          <QueryError error={error()} retryLabel={api.t('actions.retry')} retry={retry} />
        </Layout>
      )}
    >
      <Loading fallback={<Waiting />}>
        <Layout ready>
          <dl class="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
            <dt class="text-muted-foreground">{api.t('application.about.version')}</dt>
            <dd class="m-0 wrap-break-word">{info().version}</dd>
            <dt class="text-muted-foreground">{api.t('application.about.operatingSystem')}</dt>
            <dd class="m-0 wrap-break-word">
              {info().operatingSystem.name} {info().operatingSystem.version}
            </dd>
            <dt class="text-muted-foreground">{api.t('application.about.architecture')}</dt>
            <dd class="m-0">{info().architecture}</dd>
          </dl>
        </Layout>
      </Loading>
    </Errored>
  )
}
