/** @fileoverview Creates fresh product defaults for the actual platform and native navigation order. */

import { parsePreferences } from '@kisaki3/desktop-contracts/preferences'
import type { DesktopPlatform, Preferences } from '@kisaki3/desktop-contracts/preferences'
import type { PageRef } from '@kisaki3/desktop-contracts/ui'
import { getUsageDefaults } from './usage-defaults'
import { getShortcutDefaults } from './shortcuts'

/** Create fresh complete defaults using the platform and current native navigation directory supplied by the actual owner. */
export function getPreferencesDefaults(
  platform: DesktopPlatform,
  nativeOrder: readonly PageRef[],
): Preferences {
  return parsePreferences({
    general: { uiTranslation: { type: 'builtin', id: 'en' }, closeMainWindow: 'background' },
    appearance: { theme: { type: 'builtin', id: 'default' }, mode: 'system', interfaceScale: 100 },
    navigation: { order: nativeOrder, visibleLimit: 7 },
    library: { showNsfw: true, autoRefreshHoldings: true },
    usage: getUsageDefaults(),
    playback: { volumePercent: 100, muted: false },
    shortcuts: getShortcutDefaults(platform),
    network: { mode: 'system', endpoint: null, bypassRules: '', credentials: null },
    updates: { autoCheck: true, allowPrerelease: false },
  })
}
