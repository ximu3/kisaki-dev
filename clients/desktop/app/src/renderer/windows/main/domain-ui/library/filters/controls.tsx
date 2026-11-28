import { createSignal, For, Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { Checkbox } from '@kisaki3/desktop-ui/checkbox'
import { Field, FieldLabel } from '@kisaki3/desktop-ui/field'
import { NumberInput, SearchInput } from '@kisaki3/desktop-ui/input'
import { Select } from '@kisaki3/desktop-ui/select'
import type { EntryRef, EntryRule } from '@kisaki3/desktop-contracts/library'
import type { Translate } from '@kisaki3/desktop-localization'
import type { MainClient } from '../../../../../infrastructure/api'
import { EntryPicker } from '../picker'
import { libraryRead } from '../read'
import { object, updateObject, type Draft } from './model'

export function Choice<K extends string>(props: {
  t: Translate
  label: string
  value: K
  values: readonly K[]
  name: (k: K) => string
  change: (k: K) => void
}) {
  const { t } = props
  return (
    <Field>
      <FieldLabel>{props.label}</FieldLabel>
      <Select
        value={props.value}
        emptyMessage={t('controls.search.empty')}
        invalidSelectionMessage={t('controls.feedback.unavailable')}
        options={props.values.map((value) => ({ value, label: props.name(value) }))}
        onValueChange={(v) => {
          const key = props.values.find((k) => k === v)
          if (key !== undefined) {
            props.change(key)
          }
        }}
      />
    </Field>
  )
}
export function Multiple<K extends string | null>(props: {
  options: readonly K[]
  value: readonly K[]
  name: (v: K) => string
  change: (values: readonly K[]) => void
}) {
  return (
    <div class="flex flex-wrap gap-x-3 gap-y-2">
      <For each={props.options}>
        {(item) => (
          <label class="flex items-center gap-1.5 text-sm">
            <Checkbox
              checked={props.value.includes(item)}
              onCheckedChange={(on) =>
                props.change(on ? [...props.value, item] : props.value.filter((v) => v !== item))
              }
            />
            {props.name(item)}
          </label>
        )}
      </For>
    </div>
  )
}
export function DateParts(props: {
  t: Translate
  label: string
  value: unknown
  monthDay?: boolean
  change: (v: Draft | undefined) => void
}) {
  const { t } = props,
    keys = props.monthDay ? (['month', 'day'] as const) : (['year', 'month', 'day'] as const)
  return (
    <fieldset>
      <legend class="mb-1 text-sm">{props.label}</legend>
      <div class="flex flex-wrap gap-2">
        <For each={keys}>
          {(key) => (
            <Field class="min-w-16 flex-1">
              <FieldLabel>{t(`library.criteria.${key}`)}</FieldLabel>
              <NumberInput
                step={1}
                min={1}
                value={(object(props.value)[key] as number | undefined)?.toString() ?? ''}
                increaseLabel={t('controls.number.increase')}
                decreaseLabel={t('controls.number.decrease')}
                onValueChange={(raw) => {
                  const date = updateObject(object(props.value), {
                    [key]: raw === '' ? undefined : Number(raw),
                  })
                  props.change(Object.keys(date).length ? date : undefined)
                }}
              />
            </Field>
          )}
        </For>
      </div>
    </fieldset>
  )
}
export function EntryOperands(props: {
  api: MainClient
  types: EntryRule['types']
  value: readonly EntryRef[]
  change: (refs: readonly EntryRef[]) => void
}) {
  const { api } = props,
    t = api.t,
    [pick, setPick] = createSignal(false)
  const names = libraryRead(api, ['entries'], async (signal) => {
    const result = new Map<string, string>()
    for (let i = 0; i < props.value.length; i += 200) {
      for (const row of await api.request(
        signal,
        'library.entries.resolveRefs',
        props.value.slice(i, i + 200),
      )) {
        result.set(row.id, row.name)
      }
    }
    return result
  })
  return (
    <>
      <div class="flex flex-wrap gap-1">
        <For each={props.value}>
          {(ref) => (
            <span class="rounded bg-secondary px-2 py-1 text-xs">
              {names.result()?.value?.get(ref.id) ?? ref.id}
            </span>
          )}
        </For>
        <Button variant="outline" size="sm" onClick={() => setPick(true)}>
          {t('library.browse.pick')}
        </Button>
      </div>
      <Show when={pick()}>
        <EntryPicker
          api={api}
          types={props.types}
          title={t('library.criteria.target')}
          multiple
          initial={props.value}
          choose={props.change}
          close={() => setPick(false)}
        />
      </Show>
    </>
  )
}
export function OrganizerOperands(props: {
  api: MainClient
  kind: 'collection' | 'tag' | 'note'
  value: readonly string[]
  multiple?: boolean
  change: (ids: readonly string[]) => void
}) {
  const { api } = props,
    t = api.t,
    [search, setSearch] = createSignal(''),
    [offset, setOffset] = createSignal(0)
  const result = libraryRead(api, ['collections', 'tags', 'notes'], async (signal) => {
    const query = { search: search(), sort: { type: 'scope' as const } },
      range = { limit: 30, offset: offset() }
    if (props.kind === 'note') {
      const p = await api.request(
        signal,
        'library.notes.list',
        { search: search(), scope: { type: 'library' } },
        range,
      )
      return {
        items: p.items.map((n) => ({
          id: n.id,
          name: n.title ?? n.contentExcerpt ?? t('library.records.untitled'),
        })),
        total: p.total,
      }
    }
    return props.kind === 'tag'
      ? await api.request(signal, 'library.tags.list', query, range)
      : await api.request(
          signal,
          'library.collections.list',
          { ...query, ...(props.multiple && { membershipMode: 'manual' }) },
          range,
        )
  })
  return (
    <div class="space-y-2">
      <SearchInput
        aria-label={t('controls.search.label')}
        value={search()}
        clearLabel={t('controls.search.clear')}
        onValueChange={(v) => {
          setSearch(v)
          setOffset(0)
        }}
      />
      <div class="max-h-36 space-y-1 overflow-auto">
        <For each={result.result()?.value?.items}>
          {(item) => (
            <label class="flex items-center gap-2 text-sm">
              <Checkbox
                checked={props.value.includes(item.id)}
                onCheckedChange={(on) =>
                  props.change(
                    on
                      ? [...(props.multiple ? props.value : []), item.id]
                      : props.value.filter((id) => id !== item.id),
                  )
                }
              />
              {item.name}
            </label>
          )}
        </For>
      </div>
      <Show when={(result.result()?.value?.total ?? 0) > 30}>
        <div class="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={!offset()}
            onClick={() => setOffset((n) => n - 30)}
          >
            {t('actions.previous')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={offset() + 30 >= (result.result()?.value?.total ?? 0)}
            onClick={() => setOffset((n) => n + 30)}
          >
            {t('actions.next')}
          </Button>
        </div>
      </Show>
    </div>
  )
}
