/** @fileoverview Owns one task-center scope's filters and buffered history range. */

import { createMemo, createSignal } from 'solid-js'
import type { ListResult } from '@kisaki3/desktop-contracts/operations'
import type { TaskRunStatus, TaskRunSummary } from '@kisaki3/desktop-contracts/tasks'
import { createQuery } from '../../../../infrastructure/query'
import type { MainClient } from '../../../../infrastructure/api'

/** Maximum buffered task summaries from one consistent history snapshot. */
const windowSize = 100

/** Starts a replacement while these many rows remain available in the direction of travel. */
const preloadRows = 12

/** The user-selected conditions inside one fixed status scope. */
interface TaskFilters {
  search: string
  type: string
  status: TaskRunStatus | ''
}

/** The complete count and the buffered rows from one history read. */
interface TaskWindow extends ListResult<TaskRunSummary> {
  key: string
  revision: number
  offset: number
}

/** Keeps a buffered interval within the known bounds of the current query. */
function fitOffset(offset: number, total = Infinity) {
  return Math.max(0, Math.min(offset, total - windowSize))
}

/** Keeps one tab's query and buffered results through scrolling and invalidation. */
export function createTaskQuery(
  api: MainClient,
  statuses: readonly TaskRunStatus[],
  visible: () => boolean,
) {
  const [filters, setFilters] = createSignal<TaskFilters>({ search: '', type: '', status: '' })
  const key = createMemo(() => JSON.stringify(filters()))
  const [offset, setOffset] = createSignal(0)
  let revision = 0
  let attemptedKey: string | undefined

  const list = createQuery<TaskWindow | undefined>({
    prepare() {
      const queryKey = key()
      const { search, type, status } = filters()
      const requested = offset()
      const shown = visible()

      return async (signal): Promise<TaskWindow | undefined> => {
        const previous = list.value
        if (!shown) {
          return previous
        }

        attemptedKey = queryKey
        const generation = revision
        let start = fitOffset(requested, previous?.key === queryKey ? previous.total : undefined)
        if (
          previous?.key === queryKey &&
          previous.revision === generation &&
          previous.offset === start
        ) {
          return previous
        }

        const query = {
          search,
          statuses: status ? [status] : statuses,
          ...(type && { types: [type] }),
        }
        const read = (offset: number) =>
          api.request(signal, 'tasks.list', query, { offset, limit: windowSize })

        let result = await read(start)
        // Resolve a shortened tail before changing the track height and clamping its scroll position.
        while (generation === revision && result.total && start > fitOffset(start, result.total)) {
          signal.throwIfAborted()
          start = fitOffset(start, result.total)
          result = await read(start)
        }

        return generation === revision
          ? { key: queryKey, revision: generation, offset: start, ...result }
          : previous
      }
    },
  })

  const snapshot = createMemo(() => {
    const result = list.value
    return result?.key === key() ? result : undefined
  })
  const total = createMemo(() => snapshot()?.total)
  const generation = createMemo(() => `${key()}\n${snapshot()?.revision ?? ''}`)

  function changeFilter<K extends keyof TaskFilters>(field: K, value: TaskFilters[K]) {
    if (filters()[field] === value) {
      return
    }

    setFilters((current) => ({ ...current, [field]: value }))
    setOffset(0)
  }

  function requestRange(first: number, lastExclusive: number) {
    const count = total()
    if (!count || !visible()) {
      return
    }

    const start = fitOffset(offset(), count)
    const end = start + windowSize
    if (
      first >= (start ? start + preloadRows : 0) &&
      lastExclusive <= (end >= count ? count : end - preloadRows)
    ) {
      return
    }

    const padding = Math.floor((windowSize - (lastExclusive - first)) / 2)
    setOffset(fitOffset(first - padding, count))
  }

  function refresh() {
    revision += 1
    if (visible()) {
      void list.reload()
    }
  }

  return {
    /** Identifies the adopted results across range reads of the same scope and filters. */
    generation,
    filtered: () => !!(filters().search || filters().type || filters().status),
    search: () => filters().search,
    type: () => filters().type,
    status: () => filters().status,
    statuses,
    changeSearch: (value: string) => changeFilter('search', value),
    changeType: (value: string) => changeFilter('type', value),
    changeStatus: (value: TaskRunStatus | '') => changeFilter('status', value),
    /** Full result count, undefined while the current filters have no snapshot. */
    total,
    /** Reads a zero-based cached row. Undefined positions may be outside the buffered range. */
    rowAt(index: number) {
      const result = snapshot()
      return result?.items[index - result.offset]
    },
    /** Requests the viewport's half-open range of logical rows, including overscan. */
    requestRange,
    error: (): unknown => (attemptedKey === key() ? list.error : undefined),
    /** Invalidates the results and reloads the range when the tab is visible. */
    refresh,
  }
}

/** Query state shared by the toolbar and result area of one scope. */
export type TaskQueryState = ReturnType<typeof createTaskQuery>
