import { preferenceKeys, type PreferenceField } from '@kisaki3/desktop-contracts/preferences'
import type { englishMessages, Translate } from '@kisaki3/desktop-localization'

/** Field-label keys scoped to the native preference catalog. */
type FieldName = keyof typeof englishMessages.runtime.fields

/** Single-key calls from the field catalog retain the associated generated message type. */
type FieldLabelCall = { [K in FieldName]: [`runtime.fields.${K}`] }[FieldName]

/** Uses effective language at read time while keeping domain and shortcut identities stable. */
export function preferenceFields(t: Translate): readonly PreferenceField[] {
  return preferenceKeys.map((key) => {
    const segments = key.split('.')
    const labels = segments.map((word) => {
      if (word === 'main') {
        return t('runtime.mainWindow')
      }
      if (word === 'reader') {
        return t('runtime.reader')
      }
      if (word === 'player') {
        return t('runtime.player')
      }
      if (word === 'editor') {
        return t('runtime.editor')
      }
      return t(...(['runtime.fields.' + word] as FieldLabelCall))
    })
    return {
      key,
      name: labels.at(-1)!,
      description: labels.slice(0, -1).join(' · '),
      keywords: [key, ...segments],
    }
  })
}
