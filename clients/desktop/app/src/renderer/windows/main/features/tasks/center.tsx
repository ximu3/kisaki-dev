import { createSignal, For, onCleanup, Show } from 'solid-js'
import { createQuery } from '../../../../infrastructure/query'
import { mdiRefresh, mdiTrashCanOutline } from '@mdi/js'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { isTaskTerminal, taskRunStatuses, type TaskRun } from '@kisaki3/desktop-contracts/tasks'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { Alert } from '@kisaki3/desktop-ui/alert'
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
import { Tabs, TabList, Tab, TabPanel } from '@kisaki3/desktop-ui/tabs'
import { Toolbar, ToolbarRow } from '@kisaki3/desktop-ui/toolbar'
import { createConfirmation } from '../../../../infrastructure/dialogs/confirmation'
import { waitForDecision } from '../../../../infrastructure/dialogs/closing'
import type { NavigableDialog } from '../../../../infrastructure/dialogs/presentation'
import { errorMessage } from '../../../../infrastructure/notifications'
import type { MainClient } from '../../../../infrastructure/api'
import { TaskTable } from './table'
import { TaskDetails, type TaskSelection } from './details'
import { TaskFilters } from './filters'
import { createTaskQuery } from './query'

const finishedStatuses = taskRunStatuses.filter(isTaskTerminal)

const scopes = [
  {
    id: 'active',
    label: 'runtime.activeTasks',
    statuses: taskRunStatuses.filter((status) => !isTaskTerminal(status)),
  },
  {
    id: 'finished',
    label: 'runtime.finishedTasks',
    statuses: finishedStatuses,
  },
] as const

export async function readTaskTarget(
  api: MainClient,
  runId: string | undefined,
  signal: AbortSignal,
) {
  if (!runId) {
    return null
  }
  const task = await api.request(signal, 'tasks.get', { taskRunId: runId })
  if (!task) {
    throw new DesktopError('NotFound', api.t('runtime.unavailable'))
  }
  return task
}

interface TaskCenterProps {
  api: MainClient
  task: TaskRun | null
  report: (error: unknown) => void
  view: NavigableDialog
}

export function TaskCenter(props: TaskCenterProps) {
  const [visible, setVisible] = createSignal(false)

  return (
    <Dialog
      open={props.view.open()}
      onOpenChange={(open) => {
        if (!open) {
          props.view.close()
        }
      }}
    >
      <DialogContent
        size="xl"
        fill
        onToggle={(event) => {
          const open = event.currentTarget.open
          setVisible(open)
          if (open && !props.task) {
            props.view.presented()
          }
        }}
      >
        <TaskCenterContent {...props} visible={visible()} />
      </DialogContent>
    </Dialog>
  )
}

function TaskCenterContent(props: TaskCenterProps & { visible: boolean }) {
  const { api } = props
  const [revision, setRevision] = createSignal(0)
  const history = createQuery((signal) =>
    api.request(signal, 'tasks.list', { statuses: finishedStatuses }, { offset: 0, limit: 1 }),
  )
  const types = createQuery((signal) => api.request(signal, 'tasks.types'))
  const hasFinished = () => !history.error && !!history.value?.total
  const [section, setSection] = createSignal('active')
  const panels = scopes.map((scope) => ({
    ...scope,
    query: createTaskQuery(api, scope.statuses, () => section() === scope.id),
  }))
  const activeQuery = () => panels.find((scope) => scope.id === section())!.query
  deferDialogUntil(() => !!activeQuery().error() || activeQuery().total() !== undefined)
  const [selected, select] = createSignal<TaskSelection | undefined>(
    props.task
      ? { id: props.task.id, initial: props.task, presented: props.view.presented }
      : undefined,
  )

  props.view.onNavigate(async (target, signal) => {
    if (target.type !== 'tasks') {
      return false
    }
    const task = await readTaskTarget(api, target.runId, signal)
    signal.throwIfAborted()
    if (!task) {
      select(undefined)
      return true
    }
    const shown = Promise.withResolvers<boolean>()
    select({ id: task.id, initial: task, presented: () => shown.resolve(true) })
    return waitForDecision(shown.promise, signal)
  })

  function refresh() {
    for (const { query } of panels) {
      query.refresh()
    }
    void history.reload()
    void types.reload()
    setRevision((value) => value + 1)
  }
  api.topics.addEventListener('tasks.changed', refresh)
  onCleanup(() => api.topics.removeEventListener('tasks.changed', refresh))

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
              types={types.error ? undefined : types.value}
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
                <TaskTable
                  api={api}
                  active={scope.id === 'active'}
                  visible={section() === scope.id}
                  query={scope.query}
                  open={(id) => select({ id })}
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
          <Icon path={mdiTrashCanOutline} />
          {api.t('runtime.clear')}
        </Button>
        <Button
          ref={(element) => {
            refreshButton = element
          }}
          variant="outline"
          onClick={refresh}
        >
          <Icon path={mdiRefresh} />
          {api.t('runtime.refresh')}
        </Button>
      </DialogFooter>

      <confirm.Content />
      <TaskDetails
        api={api}
        selection={props.visible ? selected() : undefined}
        revision={revision()}
        onClose={() => select(undefined)}
      />
    </>
  )
}
