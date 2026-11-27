import { Show } from 'solid-js'
import type { TaskRunStatus } from '@kisaki3/desktop-contracts/tasks'
import { SearchInput } from '@kisaki3/desktop-ui/input'
import { Select } from '@kisaki3/desktop-ui/select'
import { ToolbarRow } from '@kisaki3/desktop-ui/toolbar'
import type { Translate } from '@kisaki3/desktop-localization'
import type { TaskQueryState } from './query'
import { taskTypeLabel } from './presentation'

export function TaskFilters(props: {
  t: Translate
  query: TaskQueryState
  types: readonly string[] | undefined
}) {
  const { t } = props
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
        aria-label={t('tasks.search')}
        placeholder={t('tasks.search')}
        clearLabel={t('controls.search.clear')}
        value={query().search()}
        onValueChange={(value) => query().changeSearch(value)}
      />
      <Show when={query().filtered() && query().total() !== undefined}>
        <span class="text-xs text-muted-foreground">
          {t('tasks.count', { count: query().total()! })}
        </span>
      </Show>
      <div class="ms-auto flex max-w-full flex-wrap justify-end gap-1.5">
        <Select
          size="sm"
          class="w-32 max-w-full"
          disabled={!props.types}
          aria-label={t('tasks.fields.type')}
          value={query().type() ? 'type:' + query().type() : 'all'}
          options={[
            { value: 'all', label: t('tasks.allTypes') },
            ...types().map((value) => ({
              value: 'type:' + value,
              label: taskTypeLabel(t, value),
            })),
          ]}
          emptyMessage={t('controls.search.empty')}
          invalidSelectionMessage={t('controls.feedback.unavailable')}
          onValueChange={(value) => query().changeType(value === 'all' ? '' : value.slice(5))}
        />
        <Select<TaskRunStatus | 'all'>
          size="sm"
          class="w-32 max-w-full"
          aria-label={t('tasks.fields.status')}
          value={query().status() || 'all'}
          options={[
            { value: 'all', label: t('tasks.allStatuses') },
            ...query().statuses.map((value) => ({ value, label: t(`tasks.status.${value}`) })),
          ]}
          emptyMessage={t('controls.search.empty')}
          invalidSelectionMessage={t('controls.feedback.unavailable')}
          onValueChange={(value) => query().changeStatus(value === 'all' ? '' : value)}
        />
      </div>
    </ToolbarRow>
  )
}
