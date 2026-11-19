/** @fileoverview Owns the task-center scopes, history invalidation and nested operations. */

import { createEffect, createResource, createSignal, For, onCleanup, Show } from 'solid-js'
import { RefreshCw, Trash2 } from 'lucide-solid'
import { isTaskTerminal, taskRunStatuses } from '@kisaki3/desktop-contracts/tasks'
import { Alert } from '@kisaki3/desktop-ui/alert'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  deferDialogUntil,
} from '@kisaki3/desktop-ui/dialog'
import { Tabs, TabList, Tab, TabPanel } from '@kisaki3/desktop-ui/tabs'
import { Toolbar, ToolbarRow } from '@kisaki3/desktop-ui/toolbar'
import { createConfirmation } from '../../../../infrastructure/dialogs/confirmation'
import { errorMessage } from '../../../../infrastructure/notifications'
import type { MainClient } from '../../../../infrastructure/api'
import { HistoryList } from './history-list'
import { TaskDetails } from './details'
import { TaskFilters } from './filters'
import { createTaskQuery } from './query'

/** Active execution and durable terminal history use disjoint status sets. */
const scopes = [
  {
    id: 'active',
    label: 'runtime.activeTasks',
    statuses: taskRunStatuses.filter((status) => !isTaskTerminal(status)),
  },
  {
    id: 'finished',
    label: 'runtime.finishedTasks',
    statuses: taskRunStatuses.filter(isTaskTerminal),
  },
] as const

/** Keeps each tab's query and scroll position while detail dialogs are open. */
export function TaskCenter(props: {
  api: MainClient
  target: string | null
  report: (error: unknown) => void
}) {
  const { api } = props
  const [revision, setRevision] = createSignal(0)
  const refresh = () => setRevision((value) => value + 1)
  api.topics.addEventListener('tasks.changed', refresh)
  onCleanup(() => api.topics.removeEventListener('tasks.changed', refresh))

  const [history] = createResource(revision, () =>
    api.call('tasks.list', { statuses: scopes[1].statuses }, { offset: 0, limit: 1 }),
  )
  const [types] = createResource(revision, () => api.call('tasks.types'))
  const hasFinished = () => !history.error && !!history()?.total
  const [section, setSection] = createSignal('active')
  const panels = scopes.map((scope) => ({
    ...scope,
    query: createTaskQuery(api, scope.statuses, revision),
  }))
  const activeQuery = () => panels.find((scope) => scope.id === section())!.query
  deferDialogUntil(() => !!activeQuery().error() || !!activeQuery().page())
  const [selected, select] = createSignal<string | null>(null)
  createEffect(() => select(props.target))

  const confirm = createConfirmation(api.t)
  const [clearing, setClearing] = createSignal(false)
  let refreshButton!: HTMLButtonElement

  async function clearHistory() {
    const accepted = await confirm.ask(
      api.t('runtime.clear'),
      api.t('actions.clear'),
      api.t('runtime.clearHistoryDescription'),
    )
    if (!accepted) {
      return
    }

    // The clear action becomes unavailable when the last history record is removed.
    refreshButton.focus({ preventScroll: true })
    setClearing(true)
    try {
      await api.call('tasks.clear')
    } finally {
      setClearing(false)
    }
  }

  return (
    <>
      <DialogHeader closeLabel={api.t('actions.close')}>
        <DialogTitle>{api.t('runtime.tasks')}</DialogTitle>
      </DialogHeader>
      <DialogBody class="flex min-h-0 flex-col overflow-hidden p-0">
        <Tabs class="flex min-h-0 grow flex-col" value={section()} onValueChange={setSection}>
          <Toolbar band>
            <ToolbarRow>
              <TabList aria-label={api.t('runtime.tasks')}>
                <For each={scopes}>
                  {(scope) => <Tab value={scope.id}>{api.t(scope.label)}</Tab>}
                </For>
              </TabList>
            </ToolbarRow>
            <TaskFilters
              api={api}
              query={activeQuery()}
              types={types.error ? undefined : types()}
            />
          </Toolbar>

          <Show when={history.error ?? types.error}>
            {(cause) => (
              <Alert tone="destructive" role="alert" class="m-3">
                {errorMessage(cause())}
              </Alert>
            )}
          </Show>
          <For each={panels}>
            {(scope) => (
              <TabPanel
                value={scope.id}
                class="min-h-0 grow p-0 not-[hidden]:flex not-[hidden]:flex-col"
              >
                <HistoryList
                  api={api}
                  active={scope.id === 'active'}
                  query={scope.query}
                  open={select}
                  confirm={confirm.ask}
                  report={props.report}
                />
              </TabPanel>
            )}
          </For>
        </Tabs>
      </DialogBody>
      <DialogFooter>
        <Button
          variant="outline"
          busy={clearing()}
          disabled={!hasFinished()}
          onClick={() => void clearHistory().catch(props.report)}
        >
          <Trash2 />
          {api.t('runtime.clear')}
        </Button>
        <Button ref={refreshButton} variant="outline" onClick={refresh}>
          <RefreshCw />
          {api.t('runtime.refresh')}
        </Button>
      </DialogFooter>

      <confirm.Content />
      <TaskDetails api={api} id={selected()} revision={revision()} onClose={() => select(null)} />
    </>
  )
}
