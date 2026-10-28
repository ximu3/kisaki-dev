/**
 * @fileoverview Exposes public appearance defaults in a framework-independent browser
 * consumer.
 */

import { defaultDarkTokens, defaultLightTokens } from '@kisaki3/appearance'
import type { ErrorSummary } from '@kisaki3/extension-sdk'
import '@kisaki3/appearance/styles.css'

const error: ErrorSummary | undefined = undefined

document.documentElement.dataset.tokens = JSON.stringify({
  light: defaultLightTokens,
  dark: defaultDarkTokens,
})
void error
