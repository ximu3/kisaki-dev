import {
  tokens,
  type TokenValues,
  type VisualTokenName,
  type FontTokenName,
} from '@kisaki3/desktop-appearance/tokens'
import { defaults } from '@kisaki3/desktop-appearance/defaults'
import { parseTokenValue, parseTokenValues } from '@kisaki3/desktop-appearance/values'

const values: TokenValues = parseTokenValues(defaults.light)

const visual: VisualTokenName = '--chrome'

const font: FontTokenName = '--font-sans'

export const summary = {
  radius: parseTokenValue('--radius', values['--radius']),
  kind: tokens[visual],
  font: values[font],
}
