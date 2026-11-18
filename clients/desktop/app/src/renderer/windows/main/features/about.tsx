/** @fileoverview Presents product identity, license and shareable diagnostics. */

import { createResource, Show } from 'solid-js'
import { Copy } from 'lucide-solid'
import { Alert } from '@kisaki3/desktop-ui/alert'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  deferDialogUntil,
} from '@kisaki3/desktop-ui/dialog'
import { Spinner } from '@kisaki3/desktop-ui/spinner'
import { toast } from '@kisaki3/desktop-ui/toast'
import type { MainClient } from '../../../infrastructure/api'
import { errorMessage } from '../../../infrastructure/notifications'

/** Reads the environment of this running application and copies the same facts on request. */
export function About(props: { api: MainClient; report: (error: unknown) => void }) {
  const { api } = props
  const [info, { refetch }] = createResource(() => api.call('app.environment'))
  deferDialogUntil(() => !!info.error || !!info())

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
            <h3 class="m-0 text-lg font-semibold">{api.t('runtime.appName')}</h3>
            <p class="m-0 text-xs text-muted-foreground">AGPL-3.0-only</p>
          </div>
        </div>

        <Show when={info.error}>
          {(cause) => (
            <Alert tone="destructive" role="alert">
              {errorMessage(cause())}{' '}
              <Button variant="outline" onClick={() => void refetch()}>
                {api.t('runtime.retry')}
              </Button>
            </Alert>
          )}
        </Show>
        <Show
          when={!info.error && info()}
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
          disabled={!!info.error || info.loading}
          onClick={() => void copy().catch(props.report)}
        >
          <Copy />
          {api.t('runtime.copyEnvironment')}
        </Button>
      </DialogFooter>
    </>
  )
}
