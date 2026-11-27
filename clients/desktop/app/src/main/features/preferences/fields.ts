import { preferenceKeys, type PreferenceField } from '@kisaki3/desktop-contracts/preferences'
import { formatPreferencePath, type Translate } from '@kisaki3/desktop-localization'

export function preferenceFields(t: Translate): readonly PreferenceField[] {
  return preferenceKeys.map((key) => {
    const labels = formatPreferencePath(t, key)
    return {
      key,
      name: labels.at(-1)!,
      description: labels.slice(0, -1).join(' · '),
      keywords: [key, ...key.split('.')],
    }
  })
}
