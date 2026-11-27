import { For } from 'solid-js'
import type { Translate } from '@kisaki3/desktop-localization'
import { Field, FieldContent, FieldGroup, FieldLabel, FieldLegend } from '@kisaki3/desktop-ui/field'
import { ColorInput, Input } from '@kisaki3/desktop-ui/input'
import { Textarea } from '@kisaki3/desktop-ui/textarea'
import type { ColorScheme, UserAppearanceTokens } from '@kisaki3/desktop-contracts/appearance'
import type { MainClient } from '../../../../infrastructure/api'
import { FontSelector } from '../../domain-ui/fonts/selector'
import { tokens, type TokenName } from '@kisaki3/desktop-appearance/tokens'

export const themeGroups = [
  {
    id: 'surfaces',
    names: [
      'background',
      'foreground',
      'chrome',
      'chrome-foreground',
      'popover',
      'popover-foreground',
      'dialog',
      'dialog-foreground',
    ],
  },
  {
    id: 'actions',
    names: [
      'primary',
      'primary-foreground',
      'secondary',
      'secondary-foreground',
      'muted',
      'muted-foreground',
      'accent',
      'accent-foreground',
      'input',
      'input-foreground',
    ],
  },
  {
    id: 'feedback',
    names: [
      'destructive',
      'destructive-foreground',
      'info',
      'info-foreground',
      'success',
      'success-foreground',
      'warning',
      'warning-foreground',
      'border',
      'ring',
    ],
  },
  { id: 'charts', names: ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'] },
  { id: 'geometry', names: ['radius', 'shadow-raised', 'shadow-overlay', 'shadow-modal'] },
  {
    id: 'type',
    names: [
      'font-sans',
      'font-mono',
      'text-base-weight',
      'text-base-line-height',
      'text-base-letter-spacing',
    ],
  },
] as const satisfies readonly {
  id: string
  names: readonly (TokenName extends `--${infer Name}` ? Name : never)[]
}[]

export function ThemeFields(props: {
  t: Translate
  scheme: ColorScheme
  values: UserAppearanceTokens
  api: MainClient
  change: <K extends TokenName>(key: K, value: UserAppearanceTokens[K]) => void
}) {
  function control(key: TokenName) {
    if (key === '--font-sans' || key === '--font-mono') {
      return (
        <FontSelector
          fallback="default"
          value={props.values[key]}
          api={props.api}
          onValueChange={(v) => props.change(key, v)}
        />
      )
    }
    if (tokens[key] === 'color') {
      return (
        <ColorInput
          class="w-full"
          value={props.values[key]}
          onValueChange={(v) => props.change(key, v)}
          pickerLabel={props.t('controls.color.choose')}
          hueLabel={props.t('controls.color.hue')}
          saturationLabel={props.t('controls.color.saturation')}
          brightnessLabel={props.t('controls.color.brightness')}
          alphaLabel={props.t('controls.color.alpha')}
          invalidColorMessage={props.t('controls.color.invalid')}
        />
      )
    }
    if (key.startsWith('--shadow-')) {
      return (
        <Textarea
          rows={2}
          value={props.values[key]}
          onValueChange={(value) => props.change(key, value)}
        />
      )
    }

    return (
      <Input class="w-full" value={props.values[key]} onValueChange={(v) => props.change(key, v)} />
    )
  }

  return (
    <For each={themeGroups}>
      {(group) => (
        <FieldGroup class="gap-x-4 gap-y-3 @min-[30rem]:grid-cols-2">
          <FieldLegend>{props.t(`themes.groups.${group.id}`)}</FieldLegend>
          <For each={group.names as readonly (typeof themeGroups)[number]['names'][number][]}>
            {(name) => {
              const key = `--${name}` as const
              const field = () => props.scheme + '/' + key

              return (
                <Field
                  id={'theme-field-' + field()}
                  name={field()}
                  class={key.startsWith('--shadow-') ? 'col-span-full' : undefined}
                >
                  <FieldLabel>{props.t(`themes.tokens.${name}`)}</FieldLabel>
                  <FieldContent class="w-full">{control(key)}</FieldContent>
                </Field>
              )
            }}
          </For>
        </FieldGroup>
      )}
    </For>
  )
}
