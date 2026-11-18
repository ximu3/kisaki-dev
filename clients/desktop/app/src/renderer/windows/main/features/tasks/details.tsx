/** @fileoverview Opens a prepared task report with its result and execution information. */

import { createMemo, createResource, For, Match, Show, Switch, type ParentProps } from 'solid-js'
import { CircleAlert, CircleCheck, Info, XCircle } from 'lucide-solid'
import type { JsonValue } from '@kisaki3/desktop-contracts/json'
import { isTaskTerminal, type TaskRun } from '@kisaki3/desktop-contracts/tasks'
import { Alert } from '@kisaki3/desktop-ui/alert'
import { Button } from '@kisaki3/desktop-ui/button'
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

/** Associates outcome symbols with the task's actual terminal status. */
const resultMarkers = {
  completed: { icon: CircleCheck, tone: 'text-success' },
  failed: { icon: CircleAlert, tone: 'text-destructive' },
  cancelled: { icon: XCircle, tone: 'text-muted-foreground' },
  interrupted: { icon: Info, tone: 'text-muted-foreground' },
} as const

/** Retains the report's identity through its exit and leaves the initiating row mounted. */
export function TaskDetails(props: {
  api: MainClient
  id: string | null
  revision: number
  onClose: () => void
}) {
  const displayed = createMemo<string | null>((last) => props.id ?? last, null)

  return (
    <Dialog
      open={!!props.id}
      onOpenChange={(open) => {
        if (!open) {
          props.onClose()
        }
      }}
    >
      <DialogContent size="xl">
        <Show when={displayed()} keyed>
          {(id) => <TaskDetailView api={props.api} id={id} revision={props.revision} />}
        </Show>
      </DialogContent>
    </Dialog>
  )
}

/** Reads this report before showing the dialog and retains confirmed data during refresh. */
function TaskDetailView(props: { api: MainClient; id: string; revision: number }) {
  const { api } = props
  const [detail, { refetch }] = createResource(
    () => props.revision,
    () => api.call('tasks.get', { taskRunId: props.id }),
  )
  deferDialogUntil(() => detail.state === 'ready' || detail.state === 'errored')
  const record = () => (detail.error ? undefined : detail.latest)

  return (
    <>
      <DialogHeader closeLabel={api.t('actions.close')} class="flex flex-wrap items-center gap-2">
        <TaskTypeIcon type={record()?.type} />
        <DialogTitle class="min-w-0">{record()?.title ?? api.t('runtime.detail')}</DialogTitle>
        <Show when={record()}>{(item) => <TaskStatus t={api.t} status={item().status} />}</Show>
      </DialogHeader>
      <DialogBody class="@container space-y-5 overflow-x-hidden">
        <Switch>
          <Match when={detail.error}>
            <Alert tone="destructive" role="alert">
              {errorMessage(detail.error)}{' '}
              <Button variant="outline" onClick={() => void refetch()}>
                {api.t('runtime.retry')}
              </Button>
            </Alert>
          </Match>
          <Match when={record()}>{(item) => <TaskReport api={api} item={item()} />}</Match>
          <Match when={detail.state === 'ready'}>
            <p class="m-0 text-sm text-muted-foreground">{api.t('runtime.unavailable')}</p>
          </Match>
        </Switch>
      </DialogBody>
    </>
  )
}

/** Shows result, information and recorded input as directly readable sections. */
function TaskReport(props: { api: MainClient; item: TaskRun }) {
  const { t } = props.api
  const item = () => props.item
  const date = (time: number | null) =>
    time === null
      ? undefined
      : new Intl.DateTimeFormat(document.documentElement.lang, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(time)
  const fields = () =>
    [
      { label: 'runtime.taskRunId', value: item().id },
      { label: 'runtime.type', value: taskTypeLabel(t, item().type) },
      { label: 'runtime.taskCreated', value: date(item().createdAt) },
      { label: 'runtime.taskStarted', value: date(item().startedAt) },
      { label: 'runtime.taskFinished', value: date(item().finishedAt) },
      { label: 'runtime.duration', value: taskDuration(item(), document.documentElement.lang) },
    ] as const

  return (
    <>
      <Show when={isTaskTerminal(item().status) || item().result !== null}>
        <DetailSection heading={t('runtime.result')}>
          <TaskResult api={props.api} item={item()} />
        </DetailSection>
      </Show>

      <DetailSection heading={t('runtime.taskInformation')}>
        <dl class="m-0 grid gap-x-8 gap-y-3 text-sm @min-[24rem]:grid-cols-2">
          <Show when={item().description}>
            {(description) => (
              <div class="col-span-full min-w-0">
                <dt class="text-xs text-muted-foreground">{t('runtime.taskDescription')}</dt>
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
        <DetailSection heading={t('runtime.input')}>
          <div class="overflow-hidden rounded-md border border-border">
            <TaskJson value={item().input} />
          </div>
        </DetailSection>
      </Show>
    </>
  )
}

/** Groups the status, recorded scalar values and complete output in one result surface. */
function TaskResult(props: { api: MainClient; item: TaskRun }) {
  const { t } = props.api
  const result = () => props.item.result
  const markers = () => {
    const status = props.item.status
    return isTaskTerminal(status) ? resultMarkers[status] : resultMarkers.interrupted
  }
  const values = () => {
    const value = result()
    return value && typeof value === 'object' && !Array.isArray(value)
      ? Object.entries(value).filter(
          (entry): entry is [string, number | boolean] =>
            typeof entry[1] === 'number' || typeof entry[1] === 'boolean',
        )
      : []
  }

  return (
    <div class="overflow-hidden rounded-md border border-border bg-muted/20">
      <div class="flex items-start gap-2.5 px-3 py-2.5 text-sm">
        <Show when={markers()} keyed>
          {(marker) => (
            <marker.icon aria-hidden="true" class={'mt-0.5 size-4 shrink-0 ' + marker.tone} />
          )}
        </Show>
        <div class="min-w-0">
          <div class="font-medium">{t(`tasks.${props.item.status}`)}</div>
          <Show when={props.item.error}>
            {(error) => (
              <p class="mt-1 mb-0 text-xs leading-relaxed wrap-anywhere text-destructive">
                {error().message}
              </p>
            )}
          </Show>
          <Show when={result() === null && !props.item.error}>
            <p class="mt-1 mb-0 text-xs text-muted-foreground">{t('runtime.noResult')}</p>
          </Show>
        </div>
      </div>

      <Show when={values().length}>
        <dl class="m-0 grid gap-x-8 gap-y-2 border-t border-border px-3 py-2 text-sm @min-[20rem]:grid-cols-2 @min-[32rem]:grid-cols-3">
          <For each={values()}>
            {([key, value]) => (
              <div class="min-w-0">
                <dt class="text-xs wrap-anywhere text-muted-foreground">{key}</dt>
                <dd class="m-0 tabular-nums">{String(value)}</dd>
              </div>
            )}
          </For>
        </dl>
      </Show>
      <Show when={result() !== null}>
        <div class="border-t border-border">
          <div class="border-b border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            {t('runtime.taskOutput')}
          </div>
          <TaskJson value={result()} />
        </div>
      </Show>
    </div>
  )
}

/** Uses the dialog's quiet section title and its measured gap to the contents. */
function DetailSection(props: ParentProps<{ heading: string }>) {
  return (
    <section class="grid gap-2">
      <h3 class="m-0 text-xs font-medium text-muted-foreground">{props.heading}</h3>
      {props.children}
    </section>
  )
}

/** Keeps complete input or output available in a selectable, bounded code surface. */
function TaskJson(props: { value: JsonValue }) {
  return (
    <pre class="m-0 max-h-56 overflow-auto bg-muted/50 p-3 text-xs leading-relaxed whitespace-pre-wrap wrap-anywhere">
      {JSON.stringify(props.value, null, 2)}
    </pre>
  )
}
