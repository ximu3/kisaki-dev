import { createMemo } from 'solid-js'
import { catalogKey } from '../../../../../shared/catalog-ref'
import { Select } from '@kisaki3/desktop-ui/select'
import type { ThemeRef } from '@kisaki3/desktop-contracts/appearance'
import type { Translate } from '@kisaki3/desktop-localization'
import { catalogSelection } from '../catalog-selection'

export const themeSource = {
  builtin: 'themes.source.builtin',
  user: 'themes.source.user',
  extension: 'themes.source.extension',
} as const

export interface ThemeChoice {
  ref: ThemeRef
  name: string
}

export function ThemeSelector(props: {
  value: ThemeRef | undefined
  themes: readonly ThemeChoice[] | undefined
  loading: boolean
  disabled?: boolean
  t: Translate
  onValueChange: (ref: ThemeRef) => void
}) {
  const selection = createMemo(() =>
    catalogSelection(
      props.themes?.map(({ ref, name }) => ({
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
      placeholder={props.loading ? props.t('controls.feedback.loading') : ''}
      aria-busy={props.loading ? 'true' : undefined}
      disabled={props.disabled}
      emptyMessage={props.t('controls.search.empty')}
      invalidSelectionMessage={props.t('controls.feedback.unavailable')}
      onValueChange={(key) => {
        const theme = props.themes?.find(({ ref }) => catalogKey(ref) === key)
        if (theme) {
          props.onValueChange(theme.ref)
        }
      }}
    />
  )
}
