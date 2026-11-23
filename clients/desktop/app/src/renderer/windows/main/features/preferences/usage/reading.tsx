/** @fileoverview Edits one medium's reading defaults in their layout, page, text and color groups. */

import { For, Show } from 'solid-js'
import { Settings2 } from '@lucide/solid'
import { Tooltip, TooltipContent, TooltipTrigger } from '@kisaki3/desktop-ui/tooltip'
import { FieldAction, FieldGroup, FieldLegend } from '@kisaki3/desktop-ui/field'
import { ColorInput, NumberInput } from '@kisaki3/desktop-ui/input'
import { Select } from '@kisaki3/desktop-ui/select'
import { Switch } from '@kisaki3/desktop-ui/switch'
import type { Translate } from '@kisaki3/desktop-localization'
import { FontSelector } from '../../../domain-ui/fonts/selector'
import type { UserFontOption } from '../../../domain-ui/fonts/options'
import { PreferenceField } from '../field'
import type { PreferenceFields } from '../draft'

/** Compact choices for the fixed-page viewer. */
const pageChoices = [
  { key: 'arrangement', choices: ['single', 'spread'] },
  { key: 'progression', choices: ['document', 'ltr', 'rtl'] },
  { key: 'firstPage', choices: ['single', 'paired'] },
  { key: 'fit', choices: ['page', 'width', 'height'] },
] as const

/** Fixed units for the native numeric fields in the shared reading contract. */
const textNumbers = [
  { name: 'fontSize', unit: 'px' },
  { name: 'lineHeight', unit: '×' },
  { name: 'padding', unit: 'px' },
  { name: 'maxLineLength', unit: 'em' },
  { name: 'pagesPerView', unit: undefined },
] as const

/** Reading defaults are edited against the selected medium, independently of open books. */
export function ReadingFields(props: {
  medium: 'comic' | 'novel'
  draft: PreferenceFields
  t: Translate
  users: readonly UserFontOption[]
  system: readonly string[]
  loading: boolean
  manageFonts: () => void
}) {
  const { draft, t } = props
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
        <PreferenceField field={`${prefix}.flow`} label={t('runtime.fields.flow')}>
          <Select
            value={draft.read(`${prefix}.flow`) ?? ''}
            options={(['paginated', 'continuous'] as const).map((value) => ({
              value,
              label: t(`runtime.choices.${value}`),
            }))}
            emptyMessage={t('runtime.noOptions')}
            invalidSelectionMessage={t('runtime.unavailable')}
            onValueChange={(v) => {
              if (v) {
                draft.write(`${prefix}.flow`, v)
              }
            }}
          />
        </PreferenceField>
        <PreferenceField field={`${prefix}.colors`} label={t('runtime.fields.colors')}>
          <Select
            options={(['document', 'theme', 'custom'] as const).map((value) => ({
              value,
              label: t(`runtime.choices.${value}`),
            }))}
            value={colors()?.type ?? ''}
            emptyMessage={t('runtime.noOptions')}
            invalidSelectionMessage={t('runtime.unavailable')}
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
                    const label = () => t(`runtime.themeTokens.${part}`)

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
                          pickerLabel={t('runtime.picker')}
                          hueLabel={t('runtime.hue')}
                          saturationLabel={t('runtime.saturation')}
                          brightnessLabel={t('runtime.brightness')}
                          alphaLabel={t('runtime.alpha')}
                          invalidColorMessage={t('runtime.invalidColor')}
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
        <FieldLegend>{t('runtime.fields.pages')}</FieldLegend>
        <For each={pageChoices}>
          {(item) => {
            const key = `${prefix}.pages.${item.key}` as const
            return (
              <PreferenceField field={key} label={t(`runtime.fields.${item.key}`)}>
                <Select
                  value={draft.read(key) ?? ''}
                  options={item.choices.map((value) => ({
                    value,
                    label: t(`runtime.choices.${value}`),
                  }))}
                  emptyMessage={t('runtime.noOptions')}
                  invalidSelectionMessage={t('runtime.unavailable')}
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
        <PreferenceField
          field={`${prefix}.pages.autoCrop`}
          label={t('runtime.fields.autoCrop')}
          valueClass="w-fit"
        >
          <Switch
            checked={draft.read(`${prefix}.pages.autoCrop`)}
            onCheckedChange={(v) => draft.write(`${prefix}.pages.autoCrop`, v)}
          />
        </PreferenceField>
        <For each={['brightness', 'contrast'] as const}>
          {(name) => {
            const key = `${prefix}.pages.${name}` as const
            return (
              <PreferenceField field={key} label={t(`runtime.fields.${name}`)} valueClass="w-36">
                <NumberInput
                  value={draft.read(key) ?? ''}
                  required
                  min={0}
                  max={2}
                  unit="×"
                  step="any"
                  onValueChange={(v) => draft.write(key, v)}
                  increaseLabel={t('runtime.increase')}
                  decreaseLabel={t('runtime.decrease')}
                />
              </PreferenceField>
            )
          }}
        </For>
      </FieldGroup>

      <FieldGroup>
        <FieldLegend>{t('runtime.fields.text')}</FieldLegend>
        <PreferenceField
          field={`${prefix}.text.writingMode`}
          label={t('runtime.fields.writingMode')}
        >
          <Select
            options={(['document', 'horizontal-tb', 'vertical-rl', 'vertical-lr'] as const).map(
              (value) => ({ value, label: t(`runtime.choices.${value}`) }),
            )}
            value={draft.read(`${prefix}.text.writingMode`) ?? ''}
            emptyMessage={t('runtime.noOptions')}
            invalidSelectionMessage={t('runtime.unavailable')}
            onValueChange={(v) => {
              if (v) {
                draft.write(`${prefix}.text.writingMode`, v)
              }
            }}
          />
        </PreferenceField>
        <PreferenceField field={`${prefix}.text.font`} label={t('runtime.fields.font')}>
          <FontSelector
            t={t}
            fallback="document"
            users={props.users}
            system={props.system}
            loading={props.loading}
            value={draft.read(`${prefix}.text.font`)}
            onValueChange={(v) => draft.write(`${prefix}.text.font`, v)}
          />
          <Tooltip>
            <TooltipTrigger
              as={FieldAction}
              aria-label={t('runtime.manageFonts')}
              onClick={props.manageFonts}
            >
              <Settings2 />
            </TooltipTrigger>
            <TooltipContent>{t('runtime.manage')}</TooltipContent>
          </Tooltip>
        </PreferenceField>
        <For each={textNumbers}>
          {({ name, unit }) => {
            const key = `${prefix}.text.${name}` as const
            return (
              <PreferenceField field={key} label={t(`runtime.fields.${name}`)} valueClass="w-36">
                <NumberInput
                  required
                  value={draft.read(key) ?? ''}
                  min={name === 'pagesPerView' ? 1 : 0}
                  unit={unit}
                  max={name === 'pagesPerView' ? 2 : undefined}
                  step={name === 'pagesPerView' ? 1 : 'any'}
                  onValueChange={(v) => draft.write(key, v)}
                  increaseLabel={t('runtime.increase')}
                  decreaseLabel={t('runtime.decrease')}
                />
              </PreferenceField>
            )
          }}
        </For>
        <PreferenceField
          field={`${prefix}.text.paragraphSpacing`}
          label={t('runtime.fields.paragraphSpacing')}
        >
          <Select<'document' | 'custom'>
            class="min-w-30 flex-1"
            aria-label={t('runtime.fields.paragraphSpacing')}
            options={[
              { value: 'document', label: t('runtime.choices.document') },
              { value: 'custom', label: t('runtime.choices.custom') },
            ]}
            value={spacing() === 'document' ? 'document' : 'custom'}
            emptyMessage={t('runtime.noOptions')}
            invalidSelectionMessage={t('runtime.unavailable')}
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
              aria-label={t('runtime.fields.paragraphSpacing')}
              unit="em"
              min={0}
              step="any"
              required
              value={spacing()}
              increaseLabel={t('runtime.increase')}
              decreaseLabel={t('runtime.decrease')}
              onValueChange={(value) => draft.write(`${prefix}.text.paragraphSpacing`, value)}
            />
          </Show>
        </PreferenceField>
        <PreferenceField field={`${prefix}.text.alignment`} label={t('runtime.fields.alignment')}>
          <Select
            options={(['document', 'start', 'justify'] as const).map((value) => ({
              value,
              label: t(`runtime.choices.${value}`),
            }))}
            value={draft.read(`${prefix}.text.alignment`) ?? ''}
            emptyMessage={t('runtime.noOptions')}
            invalidSelectionMessage={t('runtime.unavailable')}
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
