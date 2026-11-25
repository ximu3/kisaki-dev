import type { Translate } from '@kisaki3/desktop-localization'
import { catalogKey } from '../../../../shared/catalog-ref'

export function catalogSelection<T extends { value: string; label: string }>(
  options: readonly T[] | undefined,
  saved: Parameters<typeof catalogKey>[0] | undefined,
  t: Translate,
) {
  if (options === undefined) {
    return { value: '', options: [] }
  }

  const value = saved ? catalogKey(saved) : 'unavailable'
  if (options.some((option) => option.value === value)) {
    return { value, options }
  }

  const name = saved?.type === 'extension' ? `${saved.extensionId} / ${saved.id}` : saved?.id
  const label = name ? t('runtime.unavailableResource', { name }) : t('runtime.unavailable')
  return { value, options: [...options, { value, label }] }
}
