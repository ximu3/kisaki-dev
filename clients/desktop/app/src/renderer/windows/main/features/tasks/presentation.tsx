/** @fileoverview Presents task type, status and duration consistently across the task center. */

import { Dynamic } from 'solid-js/web'
import { ClipboardList, FolderSearch, RefreshCw, ScanLine } from 'lucide-solid'
import type { TaskRunStatus, TaskRunSummary } from '@kisaki3/desktop-contracts/tasks'
import type { englishMessages, Translate } from '@kisaki3/desktop-localization'
import { Badge } from '@kisaki3/desktop-ui/badge'

/** Uses a common text treatment across list rows and details. */
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

/** Catalog keys for types recognized by the desktop task center. */
type TaskTypeMessage = `tasks.types.${keyof typeof englishMessages.tasks.types}`

/** Matches each recognized task type to a localized label and an identifying symbol. */
const taskTypes = new Map<string, { message: TaskTypeMessage; icon: typeof ClipboardList }>([
  ['scanner.scan', { message: 'tasks.types.directoryScan', icon: FolderSearch }],
  ['library.scan', { message: 'tasks.types.libraryScan', icon: ScanLine }],
  ['library.refresh', { message: 'tasks.types.libraryRefresh', icon: RefreshCw }],
])

/** Localizes type labels in both filters and details, preserving unfamiliar identities. */
export function taskTypeLabel(t: Translate, type: string): string {
  const message = taskTypes.get(type)?.message
  return message ? t(message) : t('tasks.unrecognizedType', { type })
}

/** Displays the type symbol alongside task text, using the generic task symbol for unknown types. */
export function TaskTypeIcon(props: { type?: string | undefined }) {
  return (
    <Dynamic
      component={taskTypes.get(props.type ?? '')?.icon ?? ClipboardList}
      aria-hidden="true"
      class="size-4 shrink-0 text-muted-foreground"
    />
  )
}

/** Presents a text-labeled lifecycle state in the corresponding semantic tone. */
export function TaskStatus(props: { t: Translate; status: TaskRunStatus }) {
  return <Badge tone={toneByStatus[props.status]}>{props.t(`tasks.${props.status}`)}</Badge>
}

/** Formats elapsed time when both recorded times describe an ordered interval. */
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
