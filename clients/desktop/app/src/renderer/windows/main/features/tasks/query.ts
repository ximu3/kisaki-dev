import { createMemo, createSignal } from 'solid-js'
import type { ListResult } from '@kisaki3/desktop-contracts/operations'
import type { TaskRunStatus, TaskRunSummary } from '@kisaki3/desktop-contracts/tasks'
import { createSnapshot } from '../../../../infrastructure/query'
import type { MainClient } from '../../../../infrastructure/api'

const intervalSize = 100

const preloadRows = 12

interface TaskFilters {
  search: string
  type: string
  status: TaskRunStatus | ''
}

interface TaskInterval extends ListResult<TaskRunSummary> {
  key: string
  revision: number
  offset: number
}

function fitOffset(offset: number, total = Infinity) {
  return Math.max(0, Math.min(offset, total - intervalSize))
}

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

  const list = createSnapshot<TaskInterval | undefined>(async (signal, previous) => {
    const queryKey = key()
    const { search, type, status } = filters()
    const requested = offset()
    const shown = visible()

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
      api.request(signal, 'tasks.list', query, { offset, limit: intervalSize })

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
  })

  const snapshot = createMemo(() => {
    const result = list.result()?.value
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
    const end = start + intervalSize
    if (
      first >= (start ? start + preloadRows : 0) &&
      lastExclusive <= (end >= count ? count : end - preloadRows)
    ) {
      return
    }

    const padding = Math.floor((intervalSize - (lastExclusive - first)) / 2)
    setOffset(fitOffset(first - padding, count))
  }

  function refresh() {
    revision += 1
    if (visible()) {
      void list.reload()
    }
  }

  return {
    generation,
    filtered: () => !!(filters().search || filters().type || filters().status),
    search: () => filters().search,
    type: () => filters().type,
    status: () => filters().status,
    statuses,
    changeSearch: (value: string) => changeFilter('search', value),
    changeType: (value: string) => changeFilter('type', value),
    changeStatus: (value: TaskRunStatus | '') => changeFilter('status', value),
    total,
    rowAt(index: number) {
      const result = snapshot()
      return result?.items[index - result.offset]
    },
    requestRange,
    error: (): unknown => (attemptedKey === key() ? list.result()?.error : undefined),
    refresh,
  }
}

export type TaskQueryState = ReturnType<typeof createTaskQuery>
