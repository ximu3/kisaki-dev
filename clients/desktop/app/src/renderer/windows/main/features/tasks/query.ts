/** @fileoverview Owns the filters and bounded interval for one task-center scope. */

import { batch, createResource, createSignal, type Accessor } from 'solid-js'
import type { TaskRunStatus } from '@kisaki3/desktop-contracts/tasks'
import type { MainClient } from '../../../../infrastructure/api'

/** Number of task records requested at once. */
export const taskPageSize = 50

/** Reloads a scope on invalidation while retaining the query chosen by the user. */
export function createTaskQuery(
  api: MainClient,
  statuses: readonly TaskRunStatus[],
  revision: Accessor<number>,
) {
  const [search, setSearch] = createSignal('')
  const [type, setType] = createSignal('')
  const [status, setStatus] = createSignal<TaskRunStatus | ''>('')
  const [offset, setOffset] = createSignal(0)
  const key = () => JSON.stringify([search(), type(), status(), offset()])
  const filtered = () => !!(search() || type() || status())

  const [list, { refetch }] = createResource(
    () => ({
      key: key(),
      search: search(),
      type: type(),
      status: status(),
      offset: offset(),
      revision: revision(),
    }),
    async (query) => {
      const page = await api.call(
        'tasks.list',
        {
          search: query.search,
          statuses: query.status ? [query.status] : statuses,
          ...(query.type && { types: [query.type] }),
        },
        { offset: query.offset, limit: taskPageSize },
      )
      return { key: query.key, ...page }
    },
  )

  function filter(change: () => void) {
    batch(() => {
      change()
      setOffset(0)
    })
  }

  return {
    key,
    filtered,
    search,
    type,
    status,
    statuses,
    offset,
    setOffset,
    changeSearch: (value: string) => filter(() => setSearch(value)),
    changeType: (value: string) => filter(() => setType(value)),
    changeStatus: (value: TaskRunStatus | '') => filter(() => setStatus(value)),
    page: () => (!list.error && list.latest?.key === key() ? list.latest : undefined),
    error: (): unknown => list.error,
    refresh: () => void refetch(),
  }
}

/** Query state shared by the toolbar and result area of one scope. */
export type TaskQueryState = ReturnType<typeof createTaskQuery>
