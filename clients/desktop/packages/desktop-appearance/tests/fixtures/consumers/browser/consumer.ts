/** @fileoverview Consumes the packed pure entrypoints under Bundler resolution without DOM types. */

import { tokens } from '@kisaki3/desktop-appearance/tokens'
import type {
  TokenValues,
  VisualTokenName,
  FontTokenName,
} from '@kisaki3/desktop-appearance/tokens'
import { defaults } from '@kisaki3/desktop-appearance/defaults'
import { parseTokenValue, parseTokenValues } from '@kisaki3/desktop-appearance/values'

/** Complete light-theme values parsed through the installed package. */
const values: TokenValues = parseTokenValues(defaults.light)

/** A typed visual-token identity used to verify catalog lookup. */
const visual: VisualTokenName = '--chrome'

/** A typed font-token identity used to verify value lookup. */
const font: FontTokenName = '--font-sans'

/** Observed catalog and value results exposed by the packed appearance consumer. */
export const summary = {
  count: Object.keys(tokens).length,
  radius: parseTokenValue('--radius', values['--radius']),
  kind: tokens[visual],
  font: values[font],
}
