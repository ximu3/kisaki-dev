/** @fileoverview Names each preference and restores its own draft value to the product default. */

import { createContext, Show, useContext, type ParentProps } from 'solid-js'
import { RotateCcw } from '@lucide/solid'
import type { PreferenceKey } from '@kisaki3/desktop-contracts/preferences'
import type { Translate } from '@kisaki3/desktop-localization'
import {
  Field,
  FieldAction,
  FieldContent,
  FieldDescription,
  FieldHeader,
  FieldLabel,
} from '@kisaki3/desktop-ui/field'
import { Tooltip, TooltipTrigger, TooltipContent } from '@kisaki3/desktop-ui/tooltip'
import type { PreferenceFields } from './draft'

/** The surrounding preference editor owns the draft and translator for its fields. */
export const PreferenceFieldsContext = createContext<{ draft: PreferenceFields; t: Translate }>()

/** Finds the field's control, including compound fields that have several focusable parts. */
export function focusPreferenceField(panel: HTMLElement, key: string) {
  const field = panel.querySelector<HTMLElement>('[data-field-key="' + CSS.escape(key) + '"]')
  if (field) {
    focusPreferenceValue(field)
  }
}

/** Prioritizes the main input of a compound control over its auxiliary buttons. */
export function focusPreferenceValue(field: HTMLElement) {
  const value = field.querySelector('[data-preference-value]')
  const target =
    value?.querySelector<HTMLElement>(
      ':is(input, textarea, select):invalid:not([tabindex="-1"], :disabled)',
    ) ??
    value?.querySelector<HTMLElement>('[data-focus-anchor]:not(:disabled)') ??
    value?.querySelector<HTMLElement>(
      ':is(input, textarea, select, button):not([tabindex="-1"], :disabled)',
    ) ??
    field
  target.focus({ preventScroll: true })
  target.scrollIntoView({ block: 'nearest' })
}

/** Places the reset action beside the field label and restores focus to the editable value. */
export function PreferenceField(
  props: ParentProps<{
    field: PreferenceKey
    label: string
    description?: string | undefined
    wide?: boolean
    valueClass?: string
  }>,
) {
  const { draft, t } = useContext(PreferenceFieldsContext)!
  let field!: HTMLDivElement
  const resetLabel = () => t('runtime.resetField')
  const valueWidth = () => props.valueClass ?? (props.wide ? 'w-full' : 'w-56')

  function reset() {
    draft.reset(props.field)
    focusPreferenceValue(field)
  }

  return (
    <Field
      ref={(node) => {
        field = node
      }}
      name={props.field}
      id={'preference-' + props.field}
      tabindex={-1}
      orientation={props.wide ? 'vertical' : 'responsive'}
    >
      <FieldHeader>
        <FieldLabel>{props.label}</FieldLabel>
        <Show when={draft.canReset(props.field)}>
          <Tooltip>
            <TooltipTrigger
              as={FieldAction}
              variant="outline"
              size="icon-xs"
              aria-label={resetLabel()}
              onClick={reset}
            >
              <RotateCcw />
            </TooltipTrigger>
            <TooltipContent>{resetLabel()}</TooltipContent>
          </Tooltip>
        </Show>
      </FieldHeader>
      <Show when={props.description}>
        {(description) => <FieldDescription>{description()}</FieldDescription>}
      </Show>
      <FieldContent class={props.wide ? 'w-full' : 'max-w-full'}>
        <div
          data-preference-value
          class={[
            'flex min-w-0 max-w-full flex-wrap items-center gap-2',
            valueWidth(),
            { '@min-[28rem]:justify-end': !props.wide },
          ]}
        >
          {props.children}
        </div>
      </FieldContent>
    </Field>
  )
}
