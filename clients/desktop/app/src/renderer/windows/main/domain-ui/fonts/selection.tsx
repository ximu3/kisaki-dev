/** @fileoverview Shares the grouped, searchable font-family selection used by theme and reading preference editors. */

import { createMemo } from 'solid-js'
import { Combobox } from '@kisaki3/desktop-ui/combobox'
import type { FontRef } from '@kisaki3/desktop-contracts/fonts'
import type { MainClient } from '../../../../infrastructure/api'

/** User-font identity and display name used by both selectors. */
interface UserFontOption {
  id: string
  name: string
}

/** Reads every catalog interval; independent library changes invalidate and refresh the selector. */
export async function listFontOptions(api: MainClient) {
  const items: UserFontOption[] = []
  let offset = 0
  for (;;) {
    const result = await api.call('fonts.list', '', { offset, limit: 200 })
    items.push(...result.items)
    offset += result.items.length
    if (offset >= result.total || !result.items.length) {
      return items
    }
  }
}

/** Retains the complete font selection, including an unavailable saved reference. */
export function FontSelector(props: {
  api: MainClient
  label: string
  fallback: 'default' | 'document'
  value: unknown
  change: (value: FontRef | { type: 'default' | 'document' }) => void
  users: readonly UserFontOption[]
  system: readonly string[]
}) {
  /** Runtime keys distinguish the default, a user-library ID and a system family with the same name. */
  const options = createMemo(() => [
    {
      value: JSON.stringify({ type: props.fallback }),
      label: props.api.t(
        props.fallback === 'document' ? 'runtime.documentFont' : 'runtime.defaultFont',
      ),
    },
    ...props.users.map((item) => ({
      value: JSON.stringify({ type: 'user', id: item.id }),
      label: item.name,
      group: props.api.t('runtime.fonts'),
    })),
    ...props.system.map((family) => ({
      value: JSON.stringify({ type: 'system', family }),
      label: family,
      group: props.api.t('runtime.systemFont'),
    })),
  ])
  /** Keeps a missing selection visible until the user explicitly picks a replacement. */
  const selected = () =>
    options().find((option) => option.value === JSON.stringify(props.value)) ?? {
      value: JSON.stringify(props.value) ?? '',
      label: props.api.t('runtime.unavailable'),
      disabled: true,
    }
  return (
    <Combobox
      aria-label={props.label}
      options={options()}
      value={selected()}
      searchLabel={props.api.t('runtime.fields.search')}
      emptyMessage={props.api.t('runtime.noMatchingFonts')}
      loadingMessage={props.api.t('runtime.loadingFonts')}
      invalidSelectionMessage={props.api.t('runtime.unavailable')}
      onValueChange={(option) => {
        if (option) {
          props.change(JSON.parse(option.value) as FontRef | { type: 'default' | 'document' })
        }
      }}
    />
  )
}
