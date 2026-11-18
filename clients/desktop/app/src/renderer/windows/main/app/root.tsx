/** @fileoverview Mounts native pages and independent, document-owned management dialogs. */

import { ErrorBoundary, Match, Show, Switch } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { Alert } from '@kisaki3/desktop-ui/alert'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kisaki3/desktop-ui/dialog'
import type { MainClient } from '../../../infrastructure/api'
import type { EditorGuard } from '../../../infrastructure/dialogs/closing'
import { Notifications, reportError } from '../../../infrastructure/notifications'
import { About } from '../features/about'
import { SystemSettings } from '../features/system/settings'
import { TaskCenter } from '../features/tasks/center'
import { PreferenceEditor } from '../features/preferences/editor'
import { Themes } from '../features/themes/manager'
import { Fonts } from '../features/fonts/manager'
import { AppShell } from './shell'
import { createNavigation, type DialogLayer } from './navigation'
import type { ManagementTarget, PageRoute } from './routes'

/** Hosts one overlay while its editor independently owns the content and footer. */
function ManagementDialog(props: {
  api: MainClient
  layer: DialogLayer
  pages: readonly PageRoute[]
  close: () => Promise<void>
  manage: (target: 'themes' | 'fonts') => void
  confirm: (guard: EditorGuard) => Promise<boolean>
}) {
  const { api, layer } = props
  const target = layer.target
  const type = () => target().type
  function size() {
    switch (type()) {
      case 'preferences':
      case 'tasks':
        return 'xl'
      case 'themes':
      case 'fonts':
        return 'lg'
      case 'about':
      case 'systemIntegration':
        return 'md'
    }
  }

  const selection = <K extends 'preferences' | 'themes' | 'fonts' | 'tasks'>(kind: K) => {
    const value = target()
    return value.type === kind ? (value as Extract<ManagementTarget, { type: K }>) : undefined
  }

  return (
    <Dialog
      open={layer.open()}
      onOpenChange={(open) => {
        if (!open && layer.open()) {
          void props.close().catch(reportError)
        }
      }}
    >
      <DialogContent
        size={size()}
        fill={type() === 'tasks' || type() === 'preferences'}
        onCloseRequest={(event) => {
          event.preventDefault()
          void props.close().catch(reportError)
        }}
      >
        <Show when={layer.instance()} keyed>
          {(_instance) => (
            <ErrorBoundary
              fallback={(error, reset) => (
                <>
                  <DialogHeader closeLabel={api.t('actions.close')}>
                    <DialogTitle>{api.t('runtime.unavailable')}</DialogTitle>
                  </DialogHeader>
                  <DialogBody>
                    <Alert tone="destructive" role="alert">
                      {error instanceof Error ? error.message : String(error)}
                    </Alert>
                  </DialogBody>
                  <DialogFooter>
                    <Button variant="outline" onClick={reset}>
                      {api.t('runtime.retry')}
                    </Button>
                  </DialogFooter>
                </>
              )}
            >
              <Switch>
                <Match when={type() === 'preferences'}>
                  <PreferenceEditor
                    api={api}
                    pages={props.pages}
                    field={selection('preferences')?.key}
                    bind={layer.bind}
                    manage={props.manage}
                  />
                </Match>
                <Match when={type() === 'tasks'}>
                  <TaskCenter
                    api={api}
                    target={selection('tasks')?.runId ?? null}
                    report={reportError}
                  />
                </Match>
                <Match when={type() === 'themes'}>
                  <Themes
                    confirm={props.confirm}
                    api={api}
                    target={selection('themes')?.ref}
                    bind={layer.bind}
                  />
                </Match>
                <Match when={type() === 'fonts'}>
                  <Fonts
                    confirm={props.confirm}
                    api={api}
                    target={selection('fonts')?.fontId}
                    bind={layer.bind}
                  />
                </Match>
                <Match when={type() === 'systemIntegration'}>
                  <SystemSettings api={api} report={reportError} />
                </Match>
                <Match when={type() === 'about'}>
                  <About api={api} report={reportError} />
                </Match>
              </Switch>
            </ErrorBoundary>
          )}
        </Show>
      </DialogContent>
    </Dialog>
  )
}

/** Preserves the registered business page and its selection while fixed tools are open. */
export function MainWindow(props: { api: MainClient; pages: readonly PageRoute[] }) {
  const { api } = props
  const nav = createNavigation(api, props.pages)
  const open = (target: ManagementTarget | PageRoute['target']) =>
    nav.navigate(target).catch((cause: unknown) => {
      reportError(cause)
      return false
    })
  const manage = (type: 'themes' | 'fonts') => nav.resource.show({ type })
  return (
    <>
      <Notifications t={api.t} />
      <AppShell
        api={api}
        pages={props.pages}
        current={nav.page()?.id}
        preferences={nav.preferences()}
        updatePreferences={nav.updatePreferences}
        reorder={nav.reorder}
        open={open}
      >
        <Show when={nav.page()}>
          {(page) => <Dynamic component={page().view} api={api} target={nav.target()} />}
        </Show>
      </AppShell>

      <ManagementDialog
        api={api}
        pages={props.pages}
        layer={nav.manager}
        manage={manage}
        confirm={nav.confirmation.ask}
        close={() => nav.close(nav.manager)}
      />
      <ManagementDialog
        api={api}
        pages={props.pages}
        layer={nav.resource}
        manage={manage}
        confirm={nav.confirmation.ask}
        close={() => nav.close(nav.resource)}
      />
      <nav.confirmation.Content />
    </>
  )
}
