import { createContext, Show, useContext, type ParentProps } from 'solid-js'
import { mdiRestore } from '@mdi/js'
import { Icon } from '@kisaki3/desktop-ui/icon'
import type { PreferenceKey } from '@kisaki3/desktop-contracts/preferences'
import { formatPreferenceField, type Translate } from '@kisaki3/desktop-localization'
import {
  Field,
  FieldAction,
  FieldContent,
  FieldDescription,
  FieldHeader,
  FieldLabel,
} from '@kisaki3/desktop-ui/field'
import { Tooltip, TooltipTrigger, TooltipContent } from '@kisaki3/desktop-ui/tooltip'
import type { PreferenceFields } from './values'

export const PreferenceFieldsContext = createContext<{ draft: PreferenceFields; t: Translate }>()

export function usePreferenceFields() {
  return useContext(PreferenceFieldsContext)!
}

export function focusPreferenceField(panel: HTMLElement, key: string) {
  const field = panel.querySelector<HTMLElement>('[data-field-key="' + CSS.escape(key) + '"]')
  if (field) {
    focusPreferenceValue(field)
  }
  return !!field
}

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

export function PreferenceField(
  props: ParentProps<{
    field: PreferenceKey
    description?: string | undefined
    wide?: boolean
    valueClass?: string
  }>,
) {
  const { draft, t } = usePreferenceFields()
  let field!: HTMLDivElement
  const resetLabel = () => t('forms.restoreDefault')
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
        <FieldLabel>{formatPreferenceField(t, props.field)}</FieldLabel>
        <Show when={draft.canReset(props.field)}>
          <Tooltip>
            <TooltipTrigger
              as={FieldAction}
              variant="outline"
              size="icon-xs"
              aria-label={resetLabel()}
              onClick={reset}
            >
              <Icon path={mdiRestore} />
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
