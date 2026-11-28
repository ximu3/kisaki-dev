import { For, Show } from 'solid-js'
import { mdiTuneVariant } from '@mdi/js'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@kisaki3/desktop-ui/tooltip'
import { FieldAction, FieldGroup, FieldLegend } from '@kisaki3/desktop-ui/field'
import { ColorInput, NumberInput } from '@kisaki3/desktop-ui/input'
import { Select } from '@kisaki3/desktop-ui/select'
import { Switch } from '@kisaki3/desktop-ui/switch'
import { FontSelector } from '../fonts/selector'
import type { MainClient } from '../../../../infrastructure/api'
import { PreferenceField, usePreferenceFields } from './field'

const pageChoices = [
  { key: 'arrangement', choices: ['single', 'spread'] },
  { key: 'progression', choices: ['document', 'ltr', 'rtl'] },
  { key: 'firstPage', choices: ['single', 'paired'] },
  { key: 'fit', choices: ['page', 'width', 'height'] },
] as const

const textNumbers = [
  { name: 'fontSize', unit: 'px', bounds: { positive: true } },
  { name: 'lineHeight', unit: '×', bounds: { positive: true } },
  { name: 'padding', unit: 'px', bounds: { min: 0 } },
  { name: 'maxLineLength', unit: 'em', bounds: { positive: true } },
  { name: 'pagesPerView', unit: undefined, bounds: { min: 1, max: 2, step: 1 } },
] as const

export function ReadingFields(props: {
  medium: 'comic' | 'novel'
  api: MainClient
  manageFonts?: () => void
}) {
  const { draft, t } = usePreferenceFields()
  const prefix = `usage.${props.medium}` as const
  const spacing = () => draft.read(`${prefix}.text.paragraphSpacing`) ?? 'document'
  const colors = () => draft.read(`${prefix}.colors`)
  const customColors = () => {
    const current = colors()
    return current?.type === 'custom' ? current : undefined
  }

  return (
    <div class="grid gap-5">
      <FieldGroup>
        <PreferenceField field={`${prefix}.flow`}>
          <Select
            value={draft.read(`${prefix}.flow`) ?? ''}
            options={(['paginated', 'continuous'] as const).map((value) => ({
              value,
              label: t(`preferences.reading.choices.${value}`),
            }))}
            emptyMessage={t('controls.search.empty')}
            invalidSelectionMessage={t('controls.feedback.unavailable')}
            onValueChange={(v) => {
              if (v) {
                draft.write(`${prefix}.flow`, v)
              }
            }}
          />
        </PreferenceField>
        <PreferenceField field={`${prefix}.colors`}>
          <Select
            options={(['document', 'theme', 'custom'] as const).map((value) => ({
              value,
              label: t(`preferences.reading.choices.${value}`),
            }))}
            value={colors()?.type ?? ''}
            emptyMessage={t('controls.search.empty')}
            invalidSelectionMessage={t('controls.feedback.unavailable')}
            onValueChange={(v) => {
              if (v) {
                draft.write(
                  `${prefix}.colors`,
                  v === 'custom'
                    ? { type: v, foreground: '#222222', background: '#ffffff' }
                    : { type: v },
                )
              }
            }}
          />
          <Show when={customColors()}>
            {(current) => (
              <div class="grid w-full gap-2">
                <For each={['foreground', 'background'] as const}>
                  {(part) => {
                    const id = 'preference-' + prefix + '.colors-' + part
                    const label = () => t(`themes.tokens.${part}`)

                    return (
                      <div class="flex items-center justify-between gap-2">
                        <label for={id} class="text-xs text-muted-foreground">
                          {label()}
                        </label>
                        <ColorInput
                          class="w-36 min-w-0"
                          id={id}
                          aria-label={label()}
                          value={current()[part]}
                          pickerLabel={t('controls.color.choose')}
                          hueLabel={t('controls.color.hue')}
                          saturationLabel={t('controls.color.saturation')}
                          brightnessLabel={t('controls.color.brightness')}
                          alphaLabel={t('controls.color.alpha')}
                          invalidColorMessage={t('controls.color.invalid')}
                          onValueChange={(value) => {
                            draft.write(`${prefix}.colors`, { ...current(), [part]: value })
                          }}
                        />
                      </div>
                    )
                  }}
                </For>
              </div>
            )}
          </Show>
        </PreferenceField>
      </FieldGroup>

      <FieldGroup>
        <FieldLegend>{t('preferences.reading.pages.title')}</FieldLegend>
        <For each={pageChoices}>
          {(item) => {
            const key = `${prefix}.pages.${item.key}` as const
            return (
              <PreferenceField field={key}>
                <Select
                  value={draft.read(key) ?? ''}
                  options={item.choices.map((value) => ({
                    value,
                    label: t(`preferences.reading.choices.${value}`),
                  }))}
                  emptyMessage={t('controls.search.empty')}
                  invalidSelectionMessage={t('controls.feedback.unavailable')}
                  onValueChange={(v) => {
                    if (v) {
                      draft.write(key, v)
                    }
                  }}
                />
              </PreferenceField>
            )
          }}
        </For>
        <PreferenceField field={`${prefix}.pages.autoCrop`} valueClass="w-fit">
          <Switch
            checked={draft.read(`${prefix}.pages.autoCrop`)}
            onCheckedChange={(v) => draft.write(`${prefix}.pages.autoCrop`, v)}
          />
        </PreferenceField>
        <For each={['brightness', 'contrast'] as const}>
          {(name) => {
            const key = `${prefix}.pages.${name}` as const
            return (
              <PreferenceField field={key} valueClass="w-36">
                <NumberInput
                  value={draft.read(key) ?? ''}
                  required
                  min={0}
                  max={200}
                  unit="%"
                  step="any"
                  onValueChange={(v) => draft.writeNumber(key, v)}
                  increaseLabel={t('controls.number.increase')}
                  decreaseLabel={t('controls.number.decrease')}
                />
              </PreferenceField>
            )
          }}
        </For>
      </FieldGroup>

      <FieldGroup>
        <FieldLegend>{t('preferences.reading.text.title')}</FieldLegend>
        <PreferenceField field={`${prefix}.text.writingMode`}>
          <Select
            options={(['document', 'horizontal-tb', 'vertical-rl', 'vertical-lr'] as const).map(
              (value) => ({ value, label: t(`preferences.reading.choices.${value}`) }),
            )}
            value={draft.read(`${prefix}.text.writingMode`) ?? ''}
            emptyMessage={t('controls.search.empty')}
            invalidSelectionMessage={t('controls.feedback.unavailable')}
            onValueChange={(v) => {
              if (v) {
                draft.write(`${prefix}.text.writingMode`, v)
              }
            }}
          />
        </PreferenceField>
        <PreferenceField field={`${prefix}.text.font`}>
          <FontSelector
            fallback="document"
            api={props.api}
            value={draft.read(`${prefix}.text.font`)}
            onValueChange={(v) => draft.write(`${prefix}.text.font`, v)}
          />
          <Show when={props.manageFonts}>
            {' '}
            <Tooltip>
              <TooltipTrigger
                as={FieldAction}
                aria-label={t('fonts.manage')}
                onClick={() => props.manageFonts?.()}
              >
                <Icon path={mdiTuneVariant} />
              </TooltipTrigger>
              <TooltipContent>{t('actions.manage')}</TooltipContent>
            </Tooltip>
          </Show>
        </PreferenceField>
        <For each={textNumbers}>
          {({ name, unit, bounds }) => {
            const key = `${prefix}.text.${name}` as const
            return (
              <PreferenceField field={key} valueClass="w-36">
                <NumberInput
                  required
                  value={draft.read(key) ?? ''}
                  unit={unit}
                  step="any"
                  {...bounds}
                  onValueChange={(v) => draft.writeNumber(key, v)}
                  increaseLabel={t('controls.number.increase')}
                  decreaseLabel={t('controls.number.decrease')}
                />
              </PreferenceField>
            )
          }}
        </For>
        <PreferenceField field={`${prefix}.text.paragraphSpacing`}>
          <Select<'document' | 'custom'>
            class="min-w-30 flex-1"
            aria-label={t('preferences.reading.text.paragraphSpacing')}
            options={[
              { value: 'document', label: t('preferences.reading.choices.document') },
              { value: 'custom', label: t('preferences.reading.choices.custom') },
            ]}
            value={spacing() === 'document' ? 'document' : 'custom'}
            emptyMessage={t('controls.search.empty')}
            invalidSelectionMessage={t('controls.feedback.unavailable')}
            onValueChange={(value) => {
              if (value) {
                draft.write(`${prefix}.text.paragraphSpacing`, value === 'document' ? value : '0')
              }
            }}
          />
          <Show when={spacing() !== 'document'}>
            <NumberInput
              id={`preference-${prefix}.text.paragraphSpacing-value`}
              class="w-24"
              aria-label={t('preferences.reading.text.paragraphSpacing')}
              unit="em"
              min={0}
              step="any"
              required
              value={spacing()}
              increaseLabel={t('controls.number.increase')}
              decreaseLabel={t('controls.number.decrease')}
              onValueChange={(value) => draft.write(`${prefix}.text.paragraphSpacing`, value)}
            />
          </Show>
        </PreferenceField>
        <PreferenceField field={`${prefix}.text.alignment`}>
          <Select
            options={(['document', 'start', 'justify'] as const).map((value) => ({
              value,
              label: t(`preferences.reading.choices.${value}`),
            }))}
            value={draft.read(`${prefix}.text.alignment`) ?? ''}
            emptyMessage={t('controls.search.empty')}
            invalidSelectionMessage={t('controls.feedback.unavailable')}
            onValueChange={(v) => {
              if (v) {
                draft.write(`${prefix}.text.alignment`, v)
              }
            }}
          />
        </PreferenceField>
      </FieldGroup>
    </div>
  )
}
