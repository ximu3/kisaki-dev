import { createSignal, For, Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { Switch } from '@kisaki3/desktop-ui/switch'
import { Field, FieldLabel } from '@kisaki3/desktop-ui/field'
import {
  workTypes,
  type EntryRule,
  type EntrySort,
  type EntryScope,
} from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../infrastructure/api'
import { TypeRange } from '../types'
import { FilterDialog } from './index'
import { Choice, OrganizerOperands } from './controls'
import { QuerySort } from './sort'

export function RuleGroups(props: {
  api: MainClient
  value: { rules: readonly EntryRule[]; sort: EntrySort }
  scopeOrder?: boolean
  change: (value: { rules: readonly EntryRule[]; sort: EntrySort }) => void
}) {
  const { api } = props,
    t = api.t,
    [editing, setEditing] = createSignal<number>()
  const update = (index: number, fields: Partial<EntryRule>) =>
    props.change({
      ...props.value,
      rules: props.value.rules.map((r, i) => (i === index ? { ...r, ...fields } : r)),
    })
  const types = () => {
    const [first, ...rest] = new Set(
      props.value.rules.filter((row) => row.enabled).flatMap((row) => row.types),
    )
    return first ? ([first, ...rest] as EntryRule['types']) : workTypes
  }
  return (
    <div class="space-y-3">
      <For each={props.value.rules.map((_, i) => i)}>
        {(index) => {
          const row = () => props.value.rules[index]!
          return (
            <fieldset class="space-y-2 rounded-md border border-border p-3">
              <legend class="px-1 text-xs">
                {t('showcase.group')} {index + 1}
              </legend>
              <Field class="flex-row">
                <FieldLabel>{t('showcase.enabled')}</FieldLabel>
                <Switch
                  checked={row().enabled}
                  onCheckedChange={(enabled) => update(index, { enabled })}
                />
              </Field>
              <TypeRange t={t} value={row().types} change={(types) => update(index, { types })} />
              <div class="flex items-center justify-between gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(index)}>
                  {t('library.browse.filter')} · {row().filter.conditions.length}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    props.change({
                      ...props.value,
                      rules: props.value.rules.filter((_, i) => i !== index),
                    })
                  }
                >
                  {t('actions.remove')}
                </Button>
              </div>
            </fieldset>
          )
        }}
      </For>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          props.change({
            ...props.value,
            rules: [
              ...props.value.rules,
              { enabled: true, types: workTypes, filter: { match: 'all', conditions: [] } },
            ],
          })
        }
      >
        {t('showcase.addGroup')}
      </Button>
      <QuerySort
        scopeOrder={props.scopeOrder ?? true}
        api={api}
        types={types()}
        value={props.value.sort}
        change={(sort) => props.change({ ...props.value, sort })}
      />
      <Show when={editing() !== undefined && props.value.rules[editing()!]}>
        {(rule) => (
          <FilterDialog
            api={api}
            rule={rule()}
            close={() => setEditing(undefined)}
            apply={(filter) => update(editing()!, { filter })}
          />
        )}
      </Show>
    </div>
  )
}
export function ScopeField(props: {
  api: MainClient
  value: EntryScope
  change: (s: EntryScope) => void
}) {
  const { api } = props,
    t = api.t
  const choice = (type: EntryScope['type']) => {
    if (type === 'tag' || type === 'collection' || type === 'note') {
      props.change({ type, id: '' })
    } else {
      props.change({ type })
    }
  }
  const name = (kind: EntryScope['type']) => {
    switch (kind) {
      case 'collection':
        return t('library.pages.collections')
      case 'tag':
        return t('library.pages.tags')
      case 'note':
        return t('library.pages.notes')
      case 'library':
      case 'favorites':
      case 'unclassified':
        return t(`library.pages.${kind}`)
    }
  }
  return (
    <div class="space-y-2">
      <Choice
        t={t}
        label={t('library.criteria.scope')}
        values={['library', 'favorites', 'unclassified', 'collection', 'tag', 'note'] as const}
        value={props.value.type}
        name={name}
        change={choice}
      />
      <Show when={'id' in props.value && props.value}>
        {(row) => (
          <OrganizerOperands
            api={api}
            kind={row().type}
            value={row().id ? [row().id] : []}
            change={(ids) => props.change({ ...row(), id: ids[0] ?? '' })}
          />
        )}
      </Show>
    </div>
  )
}
