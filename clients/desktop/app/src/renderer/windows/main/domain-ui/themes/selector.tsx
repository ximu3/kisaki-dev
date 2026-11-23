import { createMemo } from 'solid-js'
import { catalogKey } from '../../../../../shared/catalog-ref'
import { Select } from '@kisaki3/desktop-ui/select'
import type { ThemeRef } from '@kisaki3/desktop-contracts/appearance'
import type { Translate } from '@kisaki3/desktop-localization'
import { catalogSelection } from '../catalog-selection'

/** Localized ownership labels used by the selection and library views. */
export const themeSource = {
  builtin: 'runtime.themeBuiltin',
  user: 'runtime.themeUser',
  extension: 'runtime.themeExtension',
} as const

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
  const selection = createMemo(() =>
    catalogSelection(
      props.themes.map(({ ref, name }) => ({
        value: catalogKey(ref),
        label: name,
        description: props.t(themeSource[ref.type]),
      })),
      props.value,
      props.t,
    ),
  )

  return (
    <Select
      class="min-w-0 flex-1"
      value={selection().value}
      options={selection().options}
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
