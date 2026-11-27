import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  Show,
  Switch,
  type ParentProps,
} from 'solid-js'
import { createViewQuery } from '../../../../infrastructure/query'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  observeDialogTarget,
  type DialogReceipt,
} from '../../../../infrastructure/dialogs/presentation'
import type { JsonValue } from '@kisaki3/desktop-contracts/json'
import { isTaskTerminal, type TaskRun } from '@kisaki3/desktop-contracts/tasks'
import { Alert } from '@kisaki3/desktop-ui/alert'
import { Button } from '@kisaki3/desktop-ui/button'
import { Collapsible } from '@kisaki3/desktop-ui/collapsible'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  deferDialogUntil,
} from '@kisaki3/desktop-ui/dialog'
import { errorMessage } from '../../../../infrastructure/notifications'
import type { MainClient } from '../../../../infrastructure/api'
import { TaskStatus, TaskTypeIcon, taskDuration, taskTypeLabel } from './presentation'

export interface TaskSelection {
  id: string
  initial?: TaskRun
  receipt?: DialogReceipt
}

export function TaskDetails(props: {
  api: MainClient
  selection: TaskSelection | undefined
  revision: number
  onClose: () => void
}) {
  const displayed = createMemo<TaskSelection | undefined>((last) => props.selection ?? last)
  const [visible, setVisible] = createSignal(false)

  return (
    <Dialog
      open={!!props.selection}
      onOpenChange={(open) => {
        if (!open) {
          props.onClose()
        }
      }}
    >
      <DialogContent size="xl" onToggle={(event) => setVisible(event.currentTarget.open)}>
        <Show when={displayed()} keyed>
          {(selection) => (
            <TaskDetailView
              api={props.api}
              selection={selection}
              revision={props.revision}
              visible={visible()}
            />
          )}
        </Show>
      </DialogContent>
    </Dialog>
  )
}

function TaskDetailView(props: {
  api: MainClient
  selection: TaskSelection
  revision: number
  visible: boolean
}) {
  const { api, selection } = props
  let initial = selection.initial
  const detail = createViewQuery((signal) => {
    if (initial) {
      const task = initial
      initial = undefined
      return task
    }
    return api.request(signal, 'tasks.get', { taskRunId: selection.id })
  })
  createEffect(
    () => props.revision,
    () => void detail.reload(),
    { defer: true },
  )
  deferDialogUntil(() => !detail.pending())
  const record = () => detail.result()?.value
  observeDialogTarget(selection.receipt, () => ({
    presented: props.visible && !detail.pending() && !!record(),
    error:
      detail.result()?.error ??
      (detail.result()?.value === null && !detail.pending()
        ? new DesktopError('NotFound', api.t('controls.feedback.unavailable'))
        : undefined),
  }))

  return (
    <>
      <DialogHeader closeLabel={api.t('actions.close')} class="flex flex-wrap items-center gap-2">
        <TaskTypeIcon type={record()?.type} />
        <DialogTitle class="min-w-0">{record()?.title ?? api.t('tasks.details.title')}</DialogTitle>
        <Show when={record()}>{(item) => <TaskStatus t={api.t} status={item().status} />}</Show>
      </DialogHeader>
      <DialogBody class="@container space-y-5 overflow-x-hidden">
        <Switch>
          <Match when={detail.result()?.error}>
            <Alert tone="destructive" role="alert">
              {errorMessage(detail.result()?.error)}{' '}
              <Button variant="outline" onClick={() => void detail.reload()}>
                {api.t('actions.retry')}
              </Button>
            </Alert>
          </Match>
          <Match when={record()}>{(item) => <TaskReport api={api} item={item()} />}</Match>
          <Match when={!detail.pending() && !detail.result()?.error}>
            <p class="m-0 text-sm text-muted-foreground">
              {api.t('controls.feedback.unavailable')}
            </p>
          </Match>
        </Switch>
      </DialogBody>
    </>
  )
}

function TaskReport(props: { api: MainClient; item: TaskRun }) {
  const { t } = props.api
  const item = () => props.item
  const date = (time: number | null) =>
    time === null
      ? undefined
      : new Intl.DateTimeFormat(props.api.locale(), {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(time)
  const fields = () =>
    [
      { label: 'tasks.fields.id', value: item().id },
      { label: 'tasks.fields.type', value: taskTypeLabel(t, item().type) },
      { label: 'tasks.fields.createdAt', value: date(item().createdAt) },
      { label: 'tasks.fields.startedAt', value: date(item().startedAt) },
      { label: 'tasks.fields.finishedAt', value: date(item().finishedAt) },
      { label: 'tasks.fields.duration', value: taskDuration(item(), props.api.locale()) },
    ] as const

  return (
    <>
      <Show when={isTaskTerminal(item().status) || item().result !== null || item().error}>
        <DetailSection heading={t('tasks.fields.result')}>
          <TaskResult api={props.api} item={item()} />
        </DetailSection>
      </Show>

      <DetailSection heading={t('tasks.fields.information')}>
        <dl class="m-0 grid gap-x-8 gap-y-3 text-sm @min-[24rem]:grid-cols-2">
          <Show when={item().description}>
            {(description) => (
              <div class="col-span-full min-w-0">
                <dt class="text-xs text-muted-foreground">{t('tasks.fields.description')}</dt>
                <dd class="m-0 whitespace-pre-wrap wrap-anywhere">{description()}</dd>
              </div>
            )}
          </Show>
          <For each={fields()}>
            {(field) => (
              <Show when={field.value}>
                <div class="min-w-0">
                  <dt class="text-xs text-muted-foreground">{t(field.label)}</dt>
                  <dd class="m-0 wrap-anywhere tabular-nums">{field.value}</dd>
                </div>
              </Show>
            )}
          </For>
        </dl>
      </DetailSection>

      <Show when={item().input !== null}>
        <TaskJson label={t('tasks.fields.input')} value={item().input} />
      </Show>
    </>
  )
}

function TaskResult(props: { api: MainClient; item: TaskRun }) {
  const { t } = props.api
  const result = () => props.item.result
  const scalar = () => {
    const value = result()
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : undefined
  }
  const entries = createMemo(() => {
    const value = result()
    return value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value) : []
  })
  const values = createMemo(() =>
    entries().filter(
      (entry): entry is [string, number | boolean] =>
        typeof entry[1] === 'number' || typeof entry[1] === 'boolean',
    ),
  )

  return (
    <div class="grid gap-2">
      <Show when={props.item.error}>
        {(error) => <Alert tone="destructive">{error().message}</Alert>}
      </Show>
      <Switch>
        <Match when={result() === null && !props.item.error}>
          <p class="m-0 text-sm text-muted-foreground">{t('tasks.details.noResult')}</p>
        </Match>
        <Match when={result() !== null}>
          <Show when={props.item.status !== 'completed'}>
            <p class="m-0 text-sm font-medium">{t('tasks.details.partialResult')}</p>
          </Show>
          <Switch>
            <Match when={values().length}>
              <dl class="m-0 grid gap-x-8 gap-y-2 py-1 text-sm @min-[20rem]:grid-cols-2 @min-[32rem]:grid-cols-3">
                <For each={values()}>
                  {([key, value]) => (
                    <div class="min-w-0">
                      <dt class="text-xs wrap-anywhere text-muted-foreground">{key}</dt>
                      <dd class="m-0 tabular-nums">{String(value)}</dd>
                    </div>
                  )}
                </For>
              </dl>
            </Match>
            <Match when={scalar() !== undefined}>
              <p class="m-0 wrap-anywhere text-sm">{scalar()}</p>
            </Match>
            <Match when={true}>
              <p class="m-0 text-sm">{t('tasks.details.recordedResult')}</p>
            </Match>
          </Switch>
        </Match>
      </Switch>
      <Show when={result() !== null}>
        <TaskJson label={t('tasks.fields.output')} value={result()} />
      </Show>
    </div>
  )
}

function DetailSection(props: ParentProps<{ heading: string }>) {
  return (
    <section class="grid gap-2">
      <h3 class="m-0 text-xs font-medium text-muted-foreground">{props.heading}</h3>
      {props.children}
    </section>
  )
}

function TaskJson(props: { label: string; value: JsonValue }) {
  const [expanded, setExpanded] = createSignal(false)
  return (
    <Collapsible
      class="rounded-md border border-border"
      summary={props.label}
      summaryClass="px-3 py-2 text-sm"
      open={expanded()}
      onOpenChange={setExpanded}
    >
      <Show when={expanded()}>
        <pre class="m-0 max-h-56 overflow-auto border-t border-border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap wrap-anywhere">
          {JSON.stringify(props.value, null, 2)}
        </pre>
      </Show>
    </Collapsible>
  )
}
