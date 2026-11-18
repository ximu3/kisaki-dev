/** @fileoverview Renders active task controls and confirmed history rows. */

import { createSignal, onCleanup, Show } from 'solid-js'
import type { JSX } from 'solid-js'
import { FileText, Pause, Play, Trash2, X } from 'lucide-solid'
import type { TaskRunSummary, TaskState } from '@kisaki3/desktop-contracts/tasks'
import { Progress } from '@kisaki3/desktop-ui/progress'
import { TableCell, TableRow } from '@kisaki3/desktop-ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@kisaki3/desktop-ui/tooltip'
import type { MainClient } from '../../../../infrastructure/api'
import { TaskStatus, TaskTypeIcon, taskDuration } from './presentation'

/** Row identity and the action that opens its independently read detail. */
interface RowProps {
  api: MainClient
  row: TaskRunSummary
  open: () => void
}

/** Pairs a compact tool action with its accessible name and visible hint. */
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

/** Shows the task type icon and a single-line task title. */
function TaskTitle(props: { title: string; type: string }) {
  return (
    <div class="flex min-w-0 items-center gap-2">
      <TaskTypeIcon type={props.type} />
      <span class="truncate font-medium">{props.title}</span>
    </div>
  )
}

/** Owns the lightweight observation for one active row until that identity leaves the interval. */
export function ActiveRow(props: RowProps & { report: (error: unknown) => void }) {
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
    <TableRow class="h-10">
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
              icon={<Pause />}
              run={() => control('tasks.pause')}
            />
          </Show>
          <Show when={state()?.canResume}>
            <TaskAction
              label={api.t('runtime.resume')}
              icon={<Play />}
              run={() => control('tasks.resume')}
            />
          </Show>
          <Show when={state()?.canCancel}>
            <TaskAction
              label={api.t('runtime.sendCancel')}
              icon={<X />}
              run={() => control('tasks.cancel')}
              destructive
            />
          </Show>
          <TaskAction label={api.t('runtime.detail')} icon={<FileText />} run={props.open} />
        </div>
      </TableCell>
    </TableRow>
  )
}

/** Presents the ended task with actions to read or remove its saved record. */
export function FinishedRow(props: RowProps & { remove: () => void }) {
  const locale = () => document.documentElement.lang
  return (
    <TableRow class="h-10">
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
          <TaskAction label={props.api.t('runtime.detail')} icon={<FileText />} run={props.open} />
          <TaskAction
            label={props.api.t('runtime.deleteTaskAction')}
            icon={<Trash2 />}
            run={props.remove}
            destructive
          />
        </div>
      </TableCell>
    </TableRow>
  )
}
