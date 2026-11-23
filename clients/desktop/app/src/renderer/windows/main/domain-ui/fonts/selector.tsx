import { createMemo } from 'solid-js'
import { Combobox, type ComboboxOption } from '@kisaki3/desktop-ui/combobox'
import type { FontRef } from '@kisaki3/desktop-contracts/fonts'
import type { Translate } from '@kisaki3/desktop-localization'
import type { UserFontOption } from './options'

/** The surrounding editor determines the meaning of its default font. */
type FontSelection<F extends 'default' | 'document'> = FontRef | { readonly type: F }

/** A rendered key carries its exact domain value through a search or value change. */
interface FontOption<F extends 'default' | 'document'> extends ComboboxOption {
  ref?: FontSelection<F>
}

/** Encodes identity independently of display names, including colliding user and system names. */
function fontKey<F extends 'default' | 'document'>(ref: FontSelection<F>) {
  if ('id' in ref) {
    return 'user:' + ref.id
  }
  if ('family' in ref) {
    return 'system:' + ref.family
  }
  return ref.type
}

/** Renders one searchable font selection and keeps the caller's fallback type intact. */
export function FontSelector<F extends 'default' | 'document'>(props: {
  t: Translate
  fallback: F
  value: FontSelection<F> | undefined
  users: readonly UserFontOption[]
  system: readonly string[]
  loading: boolean
  onValueChange: (value: FontSelection<F>) => void
}) {
  const options = createMemo<FontOption<F>[]>(() => [
    {
      value: props.fallback,
      ref: { type: props.fallback },
      label: props.t(
        props.fallback === 'document' ? 'runtime.documentFont' : 'runtime.defaultFont',
      ),
    },
    ...props.users.map(({ id, name }) => ({
      value: 'user:' + id,
      ref: { type: 'user' as const, id },
      label: name,
      group: props.t('runtime.libraryFont'),
    })),
    ...props.system.map((family) => ({
      value: 'system:' + family,
      ref: { type: 'system' as const, family },
      label: family,
      group: props.t('runtime.systemFonts'),
    })),
  ])
  const selected = () => {
    const ref = props.value
    const key = ref ? fontKey(ref) : 'unavailable'
    const available = options().find((item) => item.value === key)
    if (available) {
      return available
    }

    // A missing reference remains part of the draft without becoming a new candidate.
    let label = props.t('runtime.unavailable')
    if (ref && 'family' in ref) {
      label = props.t('runtime.unavailableResource', { name: ref.family })
    }
    if (ref && 'id' in ref) {
      label = props.t('runtime.unavailableResource', { name: ref.id })
    }
    return { value: key, label }
  }

  return (
    <Combobox<FontOption<F>>
      class="w-48 min-w-0 max-w-full flex-1"
      options={options()}
      value={selected()}
      loading={props.loading}
      searchLabel={props.t('runtime.fields.search')}
      clearSearchLabel={props.t('runtime.clearSearch')}
      listClass="w-72"
      virtual
      emptyMessage={props.t('runtime.noMatchingFonts')}
      loadingMessage={props.t('runtime.loadingFonts')}
      invalidSelectionMessage={props.t('runtime.unavailable')}
      onValueChange={(option) => {
        if (option?.ref) {
          props.onValueChange(option.ref)
        }
      }}
    />
  )
}
