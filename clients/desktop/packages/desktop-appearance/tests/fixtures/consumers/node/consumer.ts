/** @fileoverview Consumes the packed pure entrypoints in a Node project without browser tools. */

import { tokens } from '@kisaki3/desktop-appearance/tokens'
import type {
  TokenValues,
  VisualTokenName,
  FontTokenName,
} from '@kisaki3/desktop-appearance/tokens'
import { defaults } from '@kisaki3/desktop-appearance/defaults'
import { parseTokenValue, parseTokenValues } from '@kisaki3/desktop-appearance/values'

const values: TokenValues = parseTokenValues(defaults.light)
const visual: VisualTokenName = '--chrome'
const font: FontTokenName = '--font-sans'

export const summary = {
  count: Object.keys(tokens).length,
  radius: parseTokenValue('--radius', values['--radius']),
  kind: tokens[visual],
  font: values[font],
}
