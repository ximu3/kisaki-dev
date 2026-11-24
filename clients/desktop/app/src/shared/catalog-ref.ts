import type { ThemeRef } from '@kisaki3/desktop-contracts/appearance'
import type { UiTranslationRef } from '@kisaki3/desktop-contracts/i18n'

export function catalogKey(ref: ThemeRef | UiTranslationRef): string {
  return JSON.stringify(
    ref.type === 'extension' ? [ref.type, ref.extensionId, ref.id] : [ref.type, ref.id],
  )
}
