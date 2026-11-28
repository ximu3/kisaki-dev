import { For, Show } from 'solid-js'
import { Switch } from '@kisaki3/desktop-ui/switch'
import { Field as FormField, FieldLabel } from '@kisaki3/desktop-ui/field'
import { Input } from '@kisaki3/desktop-ui/input'
import { Textarea } from '@kisaki3/desktop-ui/textarea'
import type { EntryRef, EntryRule } from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../../infrastructure/api'
import { object, list, enumValues, updateObject, type Op, type Field, type Draft } from './model'
import { DateParts } from '../../fields/date-parts'
import { LibraryReferencePicker } from '../../reference-picker'
import { Choice, Multiple, EntryOperands } from './controls'
function localTime(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return ''
  }
  const d = new Date(value)
  return new Date(value - d.getTimezoneOffset() * 60000).toISOString().slice(0, 23)
}
export function Operands(props: {
  api: MainClient
  field: Field
  body: Draft
  op: Op
  change: (body: Draft) => void
  targets?: EntryRule['types'] | undefined
}) {
  const { api } = props,
    t = api.t
  const change = (fields: Draft) => props.change(updateObject(props.body, fields))
  const bounds = (key: 'min' | 'max', value: unknown) =>
    change({ bounds: updateObject(object(props.body.bounds), { [key]: value }) })
  const vals = () => list<string | null>(props.body.values)
  const enumLabel = (v: string | null) => {
    if (v === null) {
      return t('library.criteria.unset')
    }
    if (props.field === 'status') {
      return t(`library.status.${v as 'planned'}`)
    }
    return t(`library.values.${v as 'male'}`)
  }
  return (
    <>
      <Show when={props.op === 'is'}>
        <label class="flex items-center gap-2 text-sm">
          <Switch
            checked={props.body.value === true}
            onCheckedChange={(v) => change({ value: v })}
          />
          {t(props.body.value ? 'library.criteria.yes' : 'library.criteria.no')}
        </label>
      </Show>
      <Show when={props.op === 'equals' || props.op === 'contains'}>
        <FormField>
          <FieldLabel>{t('library.criteria.value')}</FieldLabel>
          <Input
            value={(props.body.value as string) ?? ''}
            onValueChange={(v) => change({ value: v })}
          />
        </FormField>
      </Show>
      <Show when={props.op === 'kind'}>
        <Choice
          t={t}
          label={t('library.criteria.kind')}
          values={['number', 'text'] as const}
          value={props.body.value as 'number' | 'text'}
          name={(v) => t(`library.criteria.${v}`)}
          change={(v) => change({ value: v })}
        />
      </Show>
      <Show when={['componentRange', 'componentPresent', 'componentAbsent'].includes(props.op)}>
        <Choice
          t={t}
          label={t('library.criteria.field')}
          values={['year', 'month', 'day'] as const}
          value={props.body.component as 'year' | 'month' | 'day'}
          name={(v) => t(`library.criteria.${v}`)}
          change={(v) => change({ component: v })}
        />
      </Show>
      <Show when={props.op === 'range' || props.op === 'componentRange'}>
        <div class="grid grid-cols-2 gap-2">
          <For each={['min', 'max'] as const}>
            {(key) => (
              <FormField>
                <FieldLabel>{t(`library.criteria.${key}`)}</FieldLabel>
                <input
                  type="number"
                  class="h-8 rounded border border-input bg-background px-2 text-sm"
                  value={(object(props.body.bounds)[key] as number) ?? ''}
                  onInput={(e) =>
                    bounds(
                      key,
                      e.currentTarget.value === '' ? undefined : e.currentTarget.valueAsNumber,
                    )
                  }
                />
              </FormField>
            )}
          </For>
        </div>
      </Show>
      <Show when={props.op === 'absoluteRange' || props.op === 'calendarRange'}>
        <For each={['min', 'max'] as const}>
          {(key) => (
            <DateParts
              t={t}
              label={t(`library.criteria.${key}`)}
              value={object(object(props.body.bounds)[key])}
              change={(v) => bounds(key, v)}
            />
          )}
        </For>
      </Show>
      <Show when={props.op === 'monthDayRange'}>
        <For each={['from', 'to'] as const}>
          {(key) => (
            <DateParts
              t={t}
              monthDay
              label={t(key === 'from' ? 'library.criteria.min' : 'library.criteria.max')}
              value={object(props.body[key])}
              change={(v) => change({ [key]: v })}
            />
          )}
        </For>
      </Show>
      <Show when={props.op === 'instantRange'}>
        <For each={['from', 'to'] as const}>
          {(key) => (
            <FormField>
              <FieldLabel>
                {t(key === 'from' ? 'library.criteria.min' : 'library.criteria.max')}
              </FieldLabel>
              <input
                type="datetime-local"
                step="0.001"
                class="h-8 rounded border border-input bg-background px-2 text-sm"
                value={localTime(props.body[key])}
                onInput={(e) =>
                  change({
                    [key]: e.currentTarget.value
                      ? new Date(e.currentTarget.value).getTime()
                      : undefined,
                  })
                }
              />
            </FormField>
          )}
        </For>
      </Show>
      <Show when={props.op === 'in' || props.op === 'notIn'}>
        <Multiple
          options={enumValues[props.field] ?? []}
          value={vals()}
          name={enumLabel}
          change={(values) => change({ values })}
        />
      </Show>
      <Show when={props.op === 'all' || props.op === 'any' || props.op === 'none'}>
        <Show
          when={props.targets}
          fallback={
            <Show
              when={props.field === 'tags' || props.field === 'manualCollections'}
              fallback={
                <FormField>
                  <FieldLabel>{t('library.criteria.value')}</FieldLabel>
                  <Textarea
                    value={list<string>(props.body.values).join('\n')}
                    onValueChange={(v) => change({ values: v.split('\n') })}
                  />
                </FormField>
              }
            >
              <LibraryReferencePicker
                api={api}
                multiple
                kind={props.field === 'tags' ? 'tag' : 'collection'}
                value={list<string>(props.body.values)}
                change={(values) => change({ values })}
              />
            </Show>
          }
        >
          {(types) => (
            <EntryOperands
              api={api}
              types={types()}
              value={list<EntryRef>(props.body.values)}
              change={(values) => change({ values })}
            />
          )}
        </Show>
      </Show>
    </>
  )
}
