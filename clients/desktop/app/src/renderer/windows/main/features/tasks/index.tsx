/** @fileoverview Presents active tasks and finished history in the task dialog and observes live rows until they leave the view. */

import { createEffect, createResource, createSignal, For, onCleanup, Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { Tabs, TabList, Tab, TabPanel } from '@kisaki3/desktop-ui/tabs'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@kisaki3/desktop-ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@kisaki3/desktop-ui/dialog'
import { ListChecks, ListTodo, RefreshCw, Trash2 } from 'lucide-solid'
import {
  isTaskTerminal,
  taskRunStatuses,
  type TaskRunStatus,
  type TaskRunSummary,
  type TaskState,
} from '@kisaki3/desktop-contracts/tasks'
import type { MainClient } from '../../../../infrastructure/api'

/** Shared status filters used by the tab totals and the corresponding paged queries. */
const activeStatuses = taskRunStatuses.filter((s) => !isTaskTerminal(s))
/** Terminal states shared by finished-history queries and counts. */
const finishedStatuses = taskRunStatuses.filter(isTaskTerminal)

/** Renders a live row from ordered control state; removing the row releases its observation. */
function ActiveRow(props: {
  api: MainClient
  row: TaskRunSummary
  open: () => void
  report: (error: unknown) => void
}) {
  const { api } = props
  /** Holds this visible row's last ordered control snapshot. */
  const [state, setState] = createSignal<TaskState>()
  const ref = { taskRunId: props.row.id }
  /** Accepts only notifications for this row's task identity. */
  const update = (event: Event) => {
    const value = (event as CustomEvent<TaskState>).detail
    if (value.taskRunId === ref.taskRunId) {
      setState(value)
    }
  }
  api.topics.addEventListener('tasks.state', update)
  const held = api.call('tasks.observe', ref)
  void held.catch(props.report)
  onCleanup(() => {
    api.topics.removeEventListener('tasks.state', update)
    void held.then((id) => api.call('resources.release', id)).catch(props.report)
  })
  /** Requests the selected control through the actual task reference. */
  const control = (method: 'tasks.pause' | 'tasks.resume' | 'tasks.cancel') =>
    void api.call(method, ref).catch(props.report)
  /** Shows quantitative progress only for tasks that supply a total. */
  const amount = () => {
    const p = state()?.progress
    return p && 'completed' in p ? p : null
  }
  return (
    <TableRow>
      <TableCell>
        <button class="task-name" onClick={props.open}>
          {props.row.title}
        </button>
      </TableCell>
      <TableCell>{state()?.progress?.phase ?? '—'}</TableCell>
      <TableCell>
        <Show when={amount()} fallback="—">
          {(p) => (
            <progress
              aria-label={api.t('runtime.progress')}
              value={p().completed}
              max={p().total}
            />
          )}
        </Show>
      </TableCell>
      <TableCell>{api.t(`tasks.${state()?.status ?? props.row.status}`)}</TableCell>
      <TableCell>
        <div class="flex gap-1">
          <Show when={state()?.canPause}>
            <Button variant="ghost" onClick={() => control('tasks.pause')}>
              {api.t('runtime.pause')}
            </Button>
          </Show>
          <Show when={state()?.canResume}>
            <Button variant="ghost" onClick={() => control('tasks.resume')}>
              {api.t('runtime.resume')}
            </Button>
          </Show>
          <Show when={state()?.canCancel}>
            <Button variant="ghost" onClick={() => control('tasks.cancel')}>
              {api.t('actions.cancel')}
            </Button>
          </Show>
        </div>
      </TableCell>
    </TableRow>
  )
}

/** Owns the two independently filtered lists and a nested detail dialog for a single history identity. */
export function TaskCenter(props: {
  api: MainClient
  target: string | null
  report: (error: unknown) => void
}) {
  const { api } = props
  /** Tracks the selected task scope independently from row details. */
  const [section, setSection] = createSignal('active')
  /** Identifies the nested task details requested by the user or a link. */
  const [selected, select] = createSignal<string | null>(props.target)
  /** Invalidates paged history at durable checkpoints. */
  const [revision, setRevision] = createSignal(0)
  /** Schedules a fresh read of the currently displayed history. */
  const refresh = () => setRevision((n) => n + 1)
  api.topics.addEventListener('tasks.changed', refresh)
  onCleanup(() => api.topics.removeEventListener('tasks.changed', refresh))
  /** Reads the two scopes' total counts independently of search filters. */
  const [counts] = createResource(
    () => ({ revision: revision() }),
    async () =>
      Promise.all(
        [activeStatuses, finishedStatuses].map((statuses) =>
          api.call('tasks.list', { statuses }, { offset: 0, limit: 1 }),
        ),
      ),
  )
  /** Updates available task types from the same history invalidations as the tabs. */
  const [types] = createResource(
    () => ({ revision: revision() }),
    () => api.call('tasks.types'),
  )
  /** Loads full history only for the requested task. */
  const [detail] = createResource(
    () => (selected() ? { id: selected()!, revision: revision() } : null),
    (input) => api.call('tasks.get', { taskRunId: input.id }),
  )
  createEffect(() => {
    if (props.target) {
      select(props.target)
    }
  })
  /** Confirms and clears durable finished history without cancelling live work. */
  const clear = async () => {
    if (confirm(api.t('runtime.clearConfirm'))) {
      await api.call('tasks.clear', {})
    }
  }

  /** Keeps the search, type and status of each scope when switching tabs. */
  function HistoryList(part: { active: boolean }) {
    /** Keeps the search for this tab while the other tab is active. */
    const [search, setSearch] = createSignal('')
    /** Filters this tab by the recorded business operation type. */
    const [type, setType] = createSignal('')
    /** Filters this tab by one of its applicable execution states. */
    const [status, setStatus] = createSignal<TaskRunStatus | ''>('')
    /** Tracks the bounded read interval in this tab. */
    const [offset, setOffset] = createSignal(0)
    const statuses = part.active ? activeStatuses : finishedStatuses
    /** Reads rows and the matching total from one query scope. */
    const [list] = createResource(
      () => ({
        search: search(),
        type: type(),
        status: status(),
        offset: offset(),
        revision: revision(),
      }),
      (v) =>
        api.call(
          'tasks.list',
          {
            search: v.search,
            statuses: v.status ? [v.status] : statuses,
            ...(v.type && { types: [v.type] }),
          },
          { offset: v.offset, limit: 50 },
        ),
    )
    return (
      <>
        <div class="task-tools">
          <input
            type="search"
            aria-label={api.t('runtime.searchTasks')}
            placeholder={api.t('runtime.searchTasks')}
            value={search()}
            onInput={(e) => {
              setSearch(e.currentTarget.value)
              setOffset(0)
            }}
          />
          <select
            aria-label={api.t('runtime.type')}
            value={type()}
            onChange={(e) => {
              setType(e.currentTarget.value)
              setOffset(0)
            }}
          >
            <option value="">{api.t('runtime.allTypes')}</option>
            <For each={types()}>{(type) => <option value={type}>{type}</option>}</For>
          </select>
          <select
            aria-label={api.t('runtime.filter')}
            value={status()}
            onChange={(e) => {
              setStatus(e.currentTarget.value as TaskRunStatus | '')
              setOffset(0)
            }}
          >
            <option value="">{api.t('runtime.all')}</option>
            <For each={statuses}>{(v) => <option value={v}>{api.t(`tasks.${v}`)}</option>}</For>
          </select>
        </div>
        <div class="task-results">
          <Show
            when={list()?.items.length}
            fallback={
              <div class="task-empty">
                {part.active ? <ListTodo /> : <ListChecks />}
                <span>{api.t(part.active ? 'runtime.noActive' : 'runtime.noFinished')}</span>
              </div>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{api.t('runtime.name')}</TableHead>
                  <TableHead>{api.t(part.active ? 'runtime.phase' : 'runtime.result')}</TableHead>
                  <TableHead>
                    {api.t(part.active ? 'runtime.progress' : 'runtime.duration')}
                  </TableHead>
                  <TableHead>{api.t('runtime.filter')}</TableHead>
                  <TableHead>{api.t('runtime.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <For each={list()?.items}>
                  {(row) =>
                    part.active ? (
                      <ActiveRow
                        api={api}
                        row={row}
                        open={() => select(row.id)}
                        report={props.report}
                      />
                    ) : (
                      <TableRow>
                        <TableCell>
                          <button class="task-name" onClick={() => select(row.id)}>
                            {row.title}
                          </button>
                        </TableCell>
                        <TableCell>{row.error?.message ?? '—'}</TableCell>
                        <TableCell>
                          {row.startedAt !== null && row.finishedAt !== null
                            ? Intl.NumberFormat(document.documentElement.lang, {
                                style: 'unit',
                                unit: 'second',
                                maximumFractionDigits: 1,
                              }).format((row.finishedAt - row.startedAt) / 1000)
                            : '—'}
                        </TableCell>
                        <TableCell>{api.t(`tasks.${row.status}`)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" onClick={() => select(row.id)}>
                            {api.t('runtime.detail')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  }
                </For>
              </TableBody>
            </Table>
          </Show>
        </div>
        <Show when={(list()?.total ?? 0) > 50}>
          <div class="tool-row">
            <Button disabled={!offset()} onClick={() => setOffset(offset() - 50)}>
              {api.t('runtime.previous')}
            </Button>
            <Button
              disabled={offset() + 50 >= (list()?.total ?? 0)}
              onClick={() => setOffset(offset() + 50)}
            >
              {api.t('runtime.next')}
            </Button>
          </div>
        </Show>
      </>
    )
  }
  return (
    <section class="task-center">
      <Tabs value={section()} onValueChange={setSection}>
        <div class="task-band">
          <TabList aria-label={api.t('runtime.tasks')}>
            <Tab value="active">
              {api.t('runtime.active', { count: counts()?.[0]?.total ?? 0 })}
            </Tab>
            <Tab value="finished">
              {api.t('runtime.finished', { count: counts()?.[1]?.total ?? 0 })}
            </Tab>
          </TabList>
        </div>
        <For each={['active', 'finished']}>
          {(key) => (
            <TabPanel value={key}>
              <HistoryList active={key === 'active'} />
            </TabPanel>
          )}
        </For>
      </Tabs>
      <footer>
        <Button
          variant="outline"
          disabled={!counts()?.[1]?.total}
          onClick={() => void clear().catch(props.report)}
        >
          <Trash2 />
          {api.t('runtime.clear')}
        </Button>
        <Button variant="outline" onClick={refresh}>
          <RefreshCw />
          {api.t('runtime.refresh')}
        </Button>
      </footer>
      <Dialog
        open={!!selected()}
        onOpenChange={(v) => {
          if (!v) {
            select(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader closeLabel={api.t('actions.close')}>
            <DialogTitle>{detail()?.title ?? api.t('runtime.detail')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Show when={detail()} fallback={<p>{api.t('runtime.unavailable')}</p>}>
              {(item) => (
                <>
                  <p>{api.t(`tasks.${item().status}`)}</p>
                  <p>{item().description}</p>
                  <Show when={item().error}>
                    <p role="alert">{item().error!.message}</p>
                  </Show>
                  <h3>{api.t('runtime.result')}</h3>
                  <pre>
                    {item().result === null
                      ? api.t('runtime.noResult')
                      : JSON.stringify(item().result, null, 2)}
                  </pre>
                  <Show when={item().input !== null}>
                    <details>
                      <summary>{api.t('runtime.input')}</summary>
                      <pre>{JSON.stringify(item().input, null, 2)}</pre>
                    </details>
                  </Show>
                </>
              )}
            </Show>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </section>
  )
}
