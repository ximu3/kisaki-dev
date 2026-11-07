/** @fileoverview Verifies generated key and argument correlations in this consumer's actual type environment. */

import type { Translate } from '@kisaki3/desktop-localization'

/** Preserve generated key/parameter association without an arbitrary-string overload. */
export function checkTranslation(
  translate: Translate,
  key: 'library.selection' | 'library.completion.recorded',
  values: { count: number } | { name: string },
): void {
  translate('actions.save')
  translate('library.selection', { count: 2 })
  translate('library.completion.recorded', { name: 'CLANNAD' })

  // @ts-expect-error: Message groups are not leaf keys.
  translate('library')
  // @ts-expect-error: A plural argument must be a number.
  translate('library.selection', { count: 'two' })
  // @ts-expect-error: Required English parameters cannot be omitted.
  translate('library.selection')
  // @ts-expect-error: Independent key/value unions do not establish their correlation.
  translate(key, values)
}
