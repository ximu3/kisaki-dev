/** @fileoverview Selects themes by stable ownership and preserves unavailable recorded identities. */

import { catalogKey } from '../../../../../shared/catalog-ref'
import { Select } from '@kisaki3/desktop-ui/select'
import type { ThemeRef } from '@kisaki3/desktop-contracts/appearance'
import type { Translate } from '@kisaki3/desktop-localization'

/** Localized ownership labels used by the selection and library views. */
export const themeSource = {
  builtin: 'runtime.themeBuiltin',
  user: 'runtime.themeUser',
  extension: 'runtime.themeExtension',
} as const

/** Theme identity and localized display name supplied by the native catalog. */
export interface ThemeChoice {
  ref: ThemeRef
  name: string
}

/** Renders a theme reference as its listed name or its original identity when unavailable. */
export function ThemeSelector(props: {
  value: ThemeRef | undefined
  themes: readonly ThemeChoice[]
  disabled?: boolean
  t: Translate
  onValueChange: (ref: ThemeRef) => void
}) {
  const selected = () => (props.value ? catalogKey(props.value) : 'unavailable')

  function options() {
    const list = props.themes.map(({ ref, name }) => ({
      value: catalogKey(ref),
      label: name,
      description: props.t(themeSource[ref.type]),
    }))
    if (list.some((item) => item.value === selected())) {
      return list
    }

    const ref = props.value
    const name = ref?.type === 'extension' ? ref.extensionId + ' / ' + ref.id : ref?.id
    return [
      ...list,
      {
        value: selected(),
        label: name
          ? props.t('runtime.unavailableResource', { name })
          : props.t('runtime.unavailable'),
      },
    ]
  }

  return (
    <Select
      class="min-w-0 flex-1"
      value={selected()}
      options={options()}
      disabled={props.disabled}
      emptyMessage={props.t('runtime.noOptions')}
      invalidSelectionMessage={props.t('runtime.unavailable')}
      onValueChange={(key) => {
        const theme = props.themes.find(({ ref }) => catalogKey(ref) === key)
        if (theme) {
          props.onValueChange(theme.ref)
        }
      }}
    />
  )
}
