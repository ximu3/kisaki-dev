import { Show } from 'solid-js'
import {
  entrySortFields,
  entryFieldTypes,
  parseEntrySort,
  partTypes,
  partWorkType,
  type EntrySort,
  type EntryRule,
  type EntryType,
  type PartCountMeasure,
  parsePartCountScope,
} from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../infrastructure/api'
import { Choice } from './controls'
import { PartScope } from './qualifiers'

export function QuerySort(props: {
  api: MainClient
  scopeOrder?: boolean
  types: EntryRule['types']
  value: EntrySort
  change: (sort: EntrySort) => void
}) {
  const t = props.api.t,
    kind = () => {
      const v = props.value
      return v.type === 'field' ? v.field : v.type
    }
  const choices = () => {
    const fields = entrySortFields.filter((key) =>
      props.types.every((v) => (entryFieldTypes[key] as readonly EntryType[]).includes(v)),
    )
    const part = partTypes.some((k) => props.types.every((type) => type === partWorkType(k)))
    return [
      ...(props.scopeOrder === false ? [] : ['scope' as const]),
      ...fields,
      ...(part ? ['parts' as const] : []),
    ] as const
  }
  function choose(value: ReturnType<typeof kind>) {
    if (value === 'scope') {
      props.change({ type: 'scope' })
    } else if (value === 'parts') {
      const partType = partTypes.find((p) => props.types.every((type) => partWorkType(p) === type))!
      props.change({ type: 'parts', direction: 'asc', scope: { partType }, measure: 'registered' })
    } else {
      props.change({
        type: 'field',
        field: value,
        direction: props.value.type === 'scope' ? 'asc' : props.value.direction,
      })
    }
  }
  return (
    <div class="space-y-2">
      <Choice
        t={t}
        label={t('library.criteria.sort')}
        values={choices()}
        value={kind()}
        name={(key) =>
          key === 'scope' ? t('library.criteria.order') : t(`library.queryFields.${key}`)
        }
        change={choose}
      />
      <Show when={props.value.type === 'parts' && props.value}>
        {(sort) => (
          <PartScope
            api={props.api}
            types={props.types}
            scope={{ ...sort().scope }}
            measure={sort().measure}
            change={(scope, measure) =>
              props.change(
                parseEntrySort(
                  {
                    ...sort(),
                    scope: parsePartCountScope(scope),
                    measure: measure as PartCountMeasure,
                  },
                  props.types,
                ),
              )
            }
          />
        )}
      </Show>
      <Show when={props.value.type !== 'scope' && props.value}>
        {(sort) => (
          <Choice
            t={t}
            label={t('library.browse.sort')}
            value={sort().direction}
            values={['asc', 'desc'] as const}
            name={(v) => t(`library.criteria.${v}`)}
            change={(direction) => props.change({ ...sort(), direction })}
          />
        )}
      </Show>
    </div>
  )
}
