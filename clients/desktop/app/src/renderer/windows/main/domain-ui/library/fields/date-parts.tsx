import { For } from 'solid-js'
import { Field, FieldLabel } from '@kisaki3/desktop-ui/field'
import { NumberInput } from '@kisaki3/desktop-ui/input'
import type { Translate } from '@kisaki3/desktop-localization'

type DateFields = Partial<Record<'year' | 'month' | 'day', number>>

export function DateParts(props: {
  t: Translate
  label: string
  value: DateFields | null | undefined
  monthDay?: boolean
  change: (v: DateFields | undefined) => void
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
                value={props.value?.[key]?.toString() ?? ''}
                increaseLabel={t('controls.number.increase')}
                decreaseLabel={t('controls.number.decrease')}
                onValueChange={(raw) => {
                  const date = { ...props.value }
                  if (raw === '') {
                    delete date[key]
                  } else {
                    date[key] = Number(raw)
                  }
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
