/** @fileoverview Consumes the packed pure entrypoints under Bundler resolution without DOM types. */

import { tokens } from '@kisaki3/desktop-appearance/tokens'
import type {
  TokenValues,
  VisualTokenName,
  FontTokenName,
} from '@kisaki3/desktop-appearance/tokens'
import { defaults } from '@kisaki3/desktop-appearance/defaults'
import { parseTokenValue, parseTokenValues } from '@kisaki3/desktop-appearance/values'

const values: TokenValues = parseTokenValues(defaults.light)
const visual: VisualTokenName = '--ring'
const font: FontTokenName = '--font-sans'

export const summary = {
  count: Object.keys(tokens).length,
  radius: parseTokenValue('--radius', values['--radius']),
  kind: tokens[visual],
  font: values[font],
}
