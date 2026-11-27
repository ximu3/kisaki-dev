import { mdiClipboardListOutline, mdiFolderSearchOutline, mdiRefresh, mdiScanHelper } from '@mdi/js'
import { Icon } from '@kisaki3/desktop-ui/icon'
import type { TaskRunStatus, TaskRunSummary } from '@kisaki3/desktop-contracts/tasks'
import type { englishMessages, Translate } from '@kisaki3/desktop-localization'
import { Badge } from '@kisaki3/desktop-ui/badge'

const toneByStatus = {
  queued: 'secondary',
  running: 'default',
  pausing: 'warning',
  paused: 'warning',
  cancelling: 'warning',
  completed: 'success',
  failed: 'destructive',
  cancelled: 'secondary',
  interrupted: 'warning',
} as const satisfies Record<TaskRunStatus, string>

type TaskTypeMessage = `tasks.types.${keyof typeof englishMessages.tasks.types}`

const taskTypes = new Map<string, { message: TaskTypeMessage; icon: string }>([
  ['scanner.scan', { message: 'tasks.types.directoryScan', icon: mdiFolderSearchOutline }],
  ['library.scan', { message: 'tasks.types.libraryScan', icon: mdiScanHelper }],
  ['library.refresh', { message: 'tasks.types.libraryRefresh', icon: mdiRefresh }],
])

export function taskTypeLabel(t: Translate, type: string): string {
  const message = taskTypes.get(type)?.message
  return message ? t(message) : t('tasks.unrecognizedType', { type })
}

export function TaskTypeIcon(props: { type?: string | undefined }) {
  return (
    <Icon
      path={taskTypes.get(props.type ?? '')?.icon ?? mdiClipboardListOutline}
      class="size-4 shrink-0 text-muted-foreground"
    />
  )
}

export function TaskStatus(props: { t: Translate; status: TaskRunStatus }) {
  return <Badge tone={toneByStatus[props.status]}>{props.t(`tasks.status.${props.status}`)}</Badge>
}

export function taskDuration(row: TaskRunSummary, locale: string): string | undefined {
  if (row.startedAt === null || row.finishedAt === null || row.finishedAt < row.startedAt) {
    return undefined
  }
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'second',
    maximumFractionDigits: 1,
  }).format((row.finishedAt - row.startedAt) / 1000)
}
