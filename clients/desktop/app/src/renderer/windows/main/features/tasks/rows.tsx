import { createSignal, onCleanup, Show } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { mdiInformationOutline, mdiPause, mdiPlay, mdiTrashCanOutline, mdiStop } from '@mdi/js'
import { Icon } from '@kisaki3/desktop-ui/icon'
import type { TaskRunSummary, TaskState } from '@kisaki3/desktop-contracts/tasks'
import { Progress } from '@kisaki3/desktop-ui/progress'
import { TableCell, TableRow } from '@kisaki3/desktop-ui/table'
import {
  createVirtualRow,
  type VirtualItem,
  type Virtualizer,
} from '@kisaki3/desktop-ui/virtualization'
import { Tooltip, TooltipContent, TooltipTrigger } from '@kisaki3/desktop-ui/tooltip'
import type { MainClient } from '../../../../infrastructure/api'
import { TaskStatus, TaskTypeIcon, taskDuration } from './presentation'

interface RowProps {
  api: MainClient
  row: TaskRunSummary
  open: () => void
}

export function TaskRow(props: {
  api: MainClient
  active: boolean
  virtualizer: Virtualizer
  item: VirtualItem
  row: TaskRunSummary | undefined
  open: (id: string) => void
  remove: (row: TaskRunSummary) => void
  report: (error: unknown) => void
}) {
  const layout = createVirtualRow(
    () => props.virtualizer,
    () => props.item,
  )

  return (
    <TableRow
      {...layout}
      class="h-10"
      aria-rowindex={props.item.index + 2}
      aria-busy={props.row ? undefined : 'true'}
    >
      <Show
        when={props.row}
        fallback={
          <TableCell colspan={props.active ? 5 : 4} class="col-span-full">
            <span aria-hidden="true" class="block h-2 w-1/3 rounded-sm bg-muted" />
          </TableCell>
        }
      >
        {(row) =>
          props.active ? (
            <ActiveCells
              api={props.api}
              row={row()}
              open={() => props.open(row().id)}
              report={props.report}
            />
          ) : (
            <FinishedCells
              api={props.api}
              row={row()}
              open={() => props.open(row().id)}
              remove={() => props.remove(row())}
            />
          )
        }
      </Show>
    </TableRow>
  )
}

function TaskAction(props: {
  label: string
  icon: JSX.Element
  run: () => void
  destructive?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        variant="ghost"
        size="icon"
        class={props.destructive ? 'hover:text-destructive' : undefined}
        aria-label={props.label}
        onClick={props.run}
      >
        {props.icon}
      </TooltipTrigger>
      <TooltipContent>{props.label}</TooltipContent>
    </Tooltip>
  )
}

function TaskTitle(props: { title: string; type: string }) {
  return (
    <div class="flex min-w-0 items-center gap-2">
      <TaskTypeIcon type={props.type} />
      <span class="truncate font-medium">{props.title}</span>
    </div>
  )
}

function ActiveCells(props: RowProps & { report: (error: unknown) => void }) {
  const { api } = props
  const [state, setState] = createSignal<TaskState>()
  const ref = { taskRunId: props.row.id }

  function update(event: Event) {
    const value = (event as CustomEvent<TaskState>).detail
    if (value.taskRunId === ref.taskRunId) {
      setState(value)
    }
  }

  api.topics.addEventListener('tasks.state', update)
  const hold = api.call('tasks.observe', ref)
  void hold.catch(props.report)
  onCleanup(() => {
    api.topics.removeEventListener('tasks.state', update)
    void hold
      .then(
        (id) => api.call('resources.release', id),
        () => {},
      )
      .catch(props.report)
  })

  const control = (method: 'tasks.pause' | 'tasks.resume' | 'tasks.cancel') =>
    void api.call(method, ref).catch(props.report)
  const quantitative = () => {
    const progress = state()?.progress
    return progress && 'completed' in progress ? progress : undefined
  }

  return (
    <>
      <TableCell>
        <TaskTitle title={props.row.title} type={props.row.type} />
      </TableCell>
      <TableCell class="truncate text-muted-foreground">{state()?.progress?.phase}</TableCell>
      <TableCell>
        <Show when={quantitative()}>
          {(progress) => (
            <Progress
              aria-label={api.t('runtime.progress')}
              value={progress().completed}
              max={progress().total}
            />
          )}
        </Show>
      </TableCell>
      <TableCell>
        <TaskStatus t={api.t} status={state()?.status ?? props.row.status} />
      </TableCell>
      <TableCell align="end">
        <div class="flex items-center justify-end gap-0.5">
          <Show when={state()?.canPause}>
            <TaskAction
              label={api.t('runtime.pause')}
              icon={<Icon path={mdiPause} />}
              run={() => control('tasks.pause')}
            />
          </Show>
          <Show when={state()?.canResume}>
            <TaskAction
              label={api.t('runtime.resume')}
              icon={<Icon path={mdiPlay} />}
              run={() => control('tasks.resume')}
            />
          </Show>
          <Show when={state()?.canCancel}>
            <TaskAction
              label={api.t('runtime.sendCancel')}
              icon={<Icon path={mdiStop} />}
              run={() => control('tasks.cancel')}
              destructive
            />
          </Show>
          <TaskAction
            label={api.t('runtime.detail')}
            icon={<Icon path={mdiInformationOutline} />}
            run={props.open}
          />
        </div>
      </TableCell>
    </>
  )
}

function FinishedCells(props: RowProps & { remove: () => void }) {
  const locale = () => document.documentElement.lang
  return (
    <>
      <TableCell>
        <TaskTitle title={props.row.title} type={props.row.type} />
      </TableCell>
      <TableCell align="end" class="whitespace-nowrap tabular-nums">
        {taskDuration(props.row, locale()) ?? '—'}
      </TableCell>
      <TableCell>
        <TaskStatus t={props.api.t} status={props.row.status} />
      </TableCell>
      <TableCell align="end">
        <div class="flex items-center justify-end gap-0.5">
          <TaskAction
            label={props.api.t('runtime.detail')}
            icon={<Icon path={mdiInformationOutline} />}
            run={props.open}
          />
          <TaskAction
            label={props.api.t('runtime.deleteTaskAction')}
            icon={<Icon path={mdiTrashCanOutline} />}
            run={props.remove}
            destructive
          />
        </div>
      </TableCell>
    </>
  )
}
