import { dynamic } from '@solidjs/web'
import { ClipboardList, FolderSearch, RefreshCw, ScanLine } from '@lucide/solid'
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

const taskTypes = new Map<string, { message: TaskTypeMessage; icon: typeof ClipboardList }>([
  ['scanner.scan', { message: 'tasks.types.directoryScan', icon: FolderSearch }],
  ['library.scan', { message: 'tasks.types.libraryScan', icon: ScanLine }],
  ['library.refresh', { message: 'tasks.types.libraryRefresh', icon: RefreshCw }],
])

export function taskTypeLabel(t: Translate, type: string): string {
  const message = taskTypes.get(type)?.message
  return message ? t(message) : t('tasks.unrecognizedType', { type })
}

export function TaskTypeIcon(props: { type?: string | undefined }) {
  const Glyph = dynamic(() => taskTypes.get(props.type ?? '')?.icon ?? ClipboardList)
  return <Glyph aria-hidden="true" class="size-4 shrink-0 text-muted-foreground" />
}

export function TaskStatus(props: { t: Translate; status: TaskRunStatus }) {
  return <Badge tone={toneByStatus[props.status]}>{props.t(`tasks.${props.status}`)}</Badge>
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
