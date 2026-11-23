import type { ThemeRef } from '@kisaki3/desktop-contracts/appearance'
import type { UiTranslationRef } from '@kisaki3/desktop-contracts/i18n'

/** Encodes ownership and the local ID in the same order in the main process and document. */
export function catalogKey(ref: ThemeRef | UiTranslationRef): string {
  return JSON.stringify(
    ref.type === 'extension' ? [ref.type, ref.extensionId, ref.id] : [ref.type, ref.id],
  )
}
