/** @fileoverview Provides the active task scope's query row for the fixed toolbar. */

import { Show } from 'solid-js'
import type { TaskRunStatus } from '@kisaki3/desktop-contracts/tasks'
import { SearchInput } from '@kisaki3/desktop-ui/input'
import { Select } from '@kisaki3/desktop-ui/select'
import { ToolbarRow } from '@kisaki3/desktop-ui/toolbar'
import type { MainClient } from '../../../../infrastructure/api'
import type { TaskQueryState } from './query'
import { taskTypeLabel } from './presentation'

/** Keeps search leading and exact-value filters trailing within the active scope. */
export function TaskFilters(props: {
  api: MainClient
  query: TaskQueryState
  types: readonly string[] | undefined
}) {
  const { api } = props
  const query = () => props.query
  const types = () => {
    const options = props.types ?? []
    const selected = query().type()
    return selected && !options.includes(selected) ? [...options, selected] : options
  }

  return (
    <ToolbarRow>
      <SearchInput
        size="sm"
        class="min-w-28 grow basis-36 max-w-xl"
        aria-label={api.t('runtime.searchTasks')}
        placeholder={api.t('runtime.searchTasks')}
        clearLabel={api.t('runtime.clearSearch')}
        value={query().search()}
        onValueChange={(value) => query().changeSearch(value)}
      />
      <Show when={query().filtered() && query().total() !== undefined}>
        <span class="text-xs text-muted-foreground">
          {api.t('runtime.taskCount', { count: query().total()! })}
        </span>
      </Show>
      <div class="ms-auto flex max-w-full flex-wrap justify-end gap-1.5">
        <Select
          size="sm"
          class="w-32 max-w-full"
          disabled={!props.types}
          aria-label={api.t('runtime.type')}
          value={query().type() ? 'type:' + query().type() : 'all'}
          defaultValue="all"
          options={[
            { value: 'all', label: api.t('runtime.allTypes') },
            ...types().map((value) => ({
              value: 'type:' + value,
              label: taskTypeLabel(api.t, value),
            })),
          ]}
          emptyMessage={api.t('runtime.noOptions')}
          invalidSelectionMessage={api.t('runtime.unavailable')}
          onValueChange={(value) => query().changeType(value === 'all' ? '' : value.slice(5))}
        />
        <Select<TaskRunStatus | 'all'>
          size="sm"
          class="w-32 max-w-full"
          aria-label={api.t('runtime.filter')}
          value={query().status() || 'all'}
          defaultValue="all"
          options={[
            { value: 'all', label: api.t('runtime.allStatuses') },
            ...query().statuses.map((value) => ({ value, label: api.t(`tasks.${value}`) })),
          ]}
          emptyMessage={api.t('runtime.noOptions')}
          invalidSelectionMessage={api.t('runtime.unavailable')}
          onValueChange={(value) => query().changeStatus(value === 'all' ? '' : value)}
        />
      </div>
    </ToolbarRow>
  )
}
