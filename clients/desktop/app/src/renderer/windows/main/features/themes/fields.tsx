/** @fileoverview Groups the editable branch by visual purpose and supplies a control appropriate for each token. */

import { For } from 'solid-js'
import type { Translate } from '@kisaki3/desktop-localization'
import { Field, FieldContent, FieldGroup, FieldLabel, FieldLegend } from '@kisaki3/desktop-ui/field'
import { ColorInput, Input } from '@kisaki3/desktop-ui/input'
import { Textarea } from '@kisaki3/desktop-ui/textarea'
import type { ColorScheme, UserAppearanceTokens } from '@kisaki3/desktop-contracts/appearance'
import type { UserFontOption } from '../../domain-ui/fonts/options'
import { FontSelector } from '../../domain-ui/fonts/selector'
import { tokens, type TokenName } from '@kisaki3/desktop-appearance/tokens'

/** Field order shared by the editor and its validation locator. */
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
      'text-base-size',
      'text-base-weight',
      'text-base-line-height',
      'text-base-letter-spacing',
    ],
  },
] as const satisfies readonly {
  id: string
  names: readonly (TokenName extends `--${infer Name}` ? Name : never)[]
}[]

/** Presents every editable token without changing its stored CSS syntax or font identity. */
export function ThemeFields(props: {
  t: Translate
  scheme: ColorScheme
  values: UserAppearanceTokens
  users: readonly UserFontOption[]
  system: readonly string[]
  loading: boolean
  change: <K extends TokenName>(key: K, value: UserAppearanceTokens[K]) => void
}) {
  function control(key: TokenName) {
    if (key === '--font-sans' || key === '--font-mono') {
      return (
        <FontSelector
          t={props.t}
          fallback="default"
          value={props.values[key]}
          users={props.users}
          system={props.system}
          loading={props.loading}
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
          pickerLabel={props.t('runtime.picker')}
          hueLabel={props.t('runtime.hue')}
          saturationLabel={props.t('runtime.saturation')}
          brightnessLabel={props.t('runtime.brightness')}
          alphaLabel={props.t('runtime.alpha')}
          invalidColorMessage={props.t('runtime.invalidColor')}
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
          <FieldLegend>{props.t(`runtime.themeGroups.${group.id}`)}</FieldLegend>
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
                  <FieldLabel>{props.t(`runtime.themeTokens.${name}`)}</FieldLabel>
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
