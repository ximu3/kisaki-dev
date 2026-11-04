/** @fileoverview Combines shared visual defaults, desktop font choices and the effective translated theme name. */

import type { Translate } from '@kisaki3/desktop-localization'
import type { Theme } from '@kisaki3/desktop-contracts/appearance'
import { light, dark } from '@kisaki3/desktop-appearance/defaults'

/** Desktop defaults reuse the delivered visual values, replacing only the two font stacks with their default selections. */
export function getDefaultTheme(t: Translate): Theme {
  return {
    ref: { type: 'builtin', id: 'default' },
    name: t('appearance.themes.default'),
    light: { ...light, '--font-sans': { type: 'default' }, '--font-mono': { type: 'default' } },
    dark: { ...dark, '--font-sans': { type: 'default' }, '--font-mono': { type: 'default' } },
  }
}
