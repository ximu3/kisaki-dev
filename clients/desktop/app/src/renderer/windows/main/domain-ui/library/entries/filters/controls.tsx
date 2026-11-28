import { createSignal, For, Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { Checkbox } from '@kisaki3/desktop-ui/checkbox'
import { Field, FieldLabel } from '@kisaki3/desktop-ui/field'
import { Select } from '@kisaki3/desktop-ui/select'
import type { EntryRef, EntryRule } from '@kisaki3/desktop-contracts/library'
import type { Translate } from '@kisaki3/desktop-localization'
import type { MainClient } from '../../../../../../infrastructure/api'
import { EntryPicker } from '../picker'
import { libraryRead } from '../../read'

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
