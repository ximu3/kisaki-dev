import { For, Show } from 'solid-js'
import { Input, NumberInput } from '@kisaki3/desktop-ui/input'
import { Select } from '@kisaki3/desktop-ui/select'
import { Field, FieldLabel } from '@kisaki3/desktop-ui/field'
import { Textarea } from '@kisaki3/desktop-ui/textarea'
import type { Translate } from '@kisaki3/desktop-localization'
import type { EntryType, CharacterMeasure } from '@kisaki3/desktop-contracts/library'
import type { PartialDate } from '@kisaki3/desktop-contracts/date'
import { countFields, detailDates, measurements } from './model'

export function InformationFields(props: {
  type: EntryType
  t: Translate
  value: Record<string, unknown>
  change: (key: string, value: unknown) => void
}) {
  const { t } = props
  const number = {
    increaseLabel: t('controls.number.increase'),
    decreaseLabel: t('controls.number.decrease'),
  }
  const options = {
    emptyMessage: t('controls.search.empty'),
    invalidSelectionMessage: t('controls.feedback.unavailable'),
  }
  function date(key: string) {
    return props.value[key] as PartialDate | null
  }
  function changeDate(key: string, part: 'year' | 'month' | 'day', value: string) {
    const next: Partial<Record<'year' | 'month' | 'day', number>> = { ...date(key) }
    if (value === '') {
      delete next[part]
    } else {
      next[part] = Number(value)
    }
    props.change(key, Object.keys(next).length ? next : null)
  }
  const enums = () => [
    ...('releaseStatus' in props.value
      ? [
          {
            key: 'releaseStatus' as const,
            items: ['planned', 'ongoing', 'finished', 'paused', 'cancelled'],
          },
        ]
      : []),
    ...('gender' in props.value
      ? [{ key: 'gender' as const, items: ['male', 'female', 'nonBinary', 'genderless', 'other'] }]
      : []),
    ...('bloodType' in props.value
      ? [{ key: 'bloodType' as const, items: ['a', 'b', 'ab', 'o'] }]
      : []),
  ]

  return (
    <>
      <Field>
        <FieldLabel>{t('library.fields.sortName')}</FieldLabel>
        <Input
          value={(props.value.sortName as string) ?? ''}
          onValueChange={(v) => props.change('sortName', v || null)}
        />
      </Field>
      <Field>
        <FieldLabel>{t('library.fields.aliases')}</FieldLabel>
        <Textarea
          rows={1}
          class="min-h-7"
          value={(props.value.aliases as string[]).join('\n')}
          onValueChange={(v) => props.change('aliases', v.split('\n'))}
        />
      </Field>
      <For each={enums()}>
        {(item) => (
          <Field>
            <FieldLabel>{t(`library.fields.${item.key}`)}</FieldLabel>
            <Select
              {...options}
              value={(props.value[item.key] as string) ?? 'unset'}
              options={[
                { value: 'unset', label: t('library.status.unset') },
                ...item.items.map((value) => ({
                  value,
                  label: t(`library.values.${value as keyof typeof valueLabels}`),
                })),
              ]}
              onValueChange={(v) => {
                if (v) {
                  props.change(item.key, v === 'unset' ? null : v)
                }
              }}
            />
          </Field>
        )}
      </For>
      <For each={countFields(props.type)}>
        {(key) => (
          <Field>
            <FieldLabel>{t(`library.fields.${key}`)}</FieldLabel>
            <NumberInput
              {...number}
              min={0}
              step={1}
              value={String((props.value[key] as number | null) ?? '')}
              onValueChange={(v) => props.change(key, v === '' ? null : Number(v))}
            />
          </Field>
        )}
      </For>
      <Show when={props.type === 'character'}>
        <For each={measurements}>
          {(key) => {
            const value = () => props.value[key] as CharacterMeasure | null
            return (
              <Field>
                <FieldLabel>{t(`library.fields.${key}`)}</FieldLabel>
                <div class="flex gap-2">
                  <Select
                    {...options}
                    value={value()?.kind ?? 'unset'}
                    options={(['unset', 'number', 'text'] as const).map((kind) => ({
                      value: kind,
                      label:
                        kind === 'unset' ? t('library.status.unset') : t(`library.values.${kind}`),
                    }))}
                    onValueChange={(v) => {
                      if (v) {
                        props.change(
                          key,
                          v === 'unset' ? null : { kind: v, value: v === 'number' ? 0 : '' },
                        )
                      }
                    }}
                  />
                  <Show when={value()}>
                    {(current) => (
                      <Input
                        value={String(current().value)}
                        onValueChange={(v) =>
                          props.change(key, {
                            kind: current().kind,
                            value: current().kind === 'number' ? Number(v) : v,
                          })
                        }
                      />
                    )}
                  </Show>
                </div>
              </Field>
            )
          }}
        </For>
        <Field>
          <FieldLabel>{t('library.fields.cupSize')}</FieldLabel>
          <Input
            value={(props.value.cupSize as string) ?? ''}
            onValueChange={(v) => props.change('cupSize', v || null)}
          />
        </Field>
      </Show>
      <Show when={'originalLanguages' in props.value}>
        <Field>
          <FieldLabel>{t('library.fields.originalLanguages')}</FieldLabel>
          <Input
            value={(props.value.originalLanguages as string[]).join(', ')}
            onValueChange={(v) =>
              props.change(
                'originalLanguages',
                v.split(',').map((s) => s.trim()),
              )
            }
          />
        </Field>
      </Show>
      <For each={detailDates(props.type)}>
        {(key) => (
          <Field name={key}>
            <FieldLabel>{t(`library.fields.${key}`)}</FieldLabel>
            <div class="grid grid-cols-3 gap-2">
              <For each={['year', 'month', 'day'] as const}>
                {(part) => (
                  <Input
                    inputmode="numeric"
                    aria-label={t(`library.fields.${key}`) + ' · ' + t(`library.fields.${part}`)}
                    placeholder={t(`library.fields.${part}`)}
                    value={String(date(key)?.[part] ?? '')}
                    onValueChange={(v) => changeDate(key, part, v)}
                  />
                )}
              </For>
            </div>
          </Field>
        )}
      </For>
    </>
  )
}
const valueLabels = {
  planned: true,
  ongoing: true,
  finished: true,
  paused: true,
  cancelled: true,
  male: true,
  female: true,
  nonBinary: true,
  genderless: true,
  other: true,
  a: true,
  b: true,
  ab: true,
  o: true,
} as const
