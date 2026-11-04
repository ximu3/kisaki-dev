/** @fileoverview Selects complete adopted usage configurations without mixing incomplete units. */

import type { UsageOverride } from '@kisaki3/desktop-contracts/preferences'

/** Select one enabled complete snapshot, never a field-by-field merge across global, work and file layers. */
export function selectCompletePreferences<T>(
  global: T,
  work: UsageOverride<T> | null,
  file: UsageOverride<T> | null,
): { readonly source: 'global' | 'work' | 'file'; readonly settings: T } {
  if (file?.enabled) {
    return { source: 'file', settings: file.settings }
  }
  if (work?.enabled) {
    return { source: 'work', settings: work.settings }
  }

  return { source: 'global', settings: global }
}
