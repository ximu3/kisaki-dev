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
const checks = [
  ['--primary', 'oklch(0.6 0.2 250 / .5)'],
  ['--font-sans', '"Library Sans", sans-serif'],
  ['--shadow-raised', 'inset 0 1px 2px #0008, 0 2px 4px -1px black'],
  ['--radius', 'calc(2px + 4px)'],
  ['--primary', 'var(--foreground)'],
  ['--primary', 'currentColor'],
] as const

export const summary = {
  count: Object.keys(tokens).length,
  radius: values['--radius'],
  kind: tokens[visual],
  font: values[font],
  validation: checks.map(([name, value]) => {
    try {
      parseTokenValue(name, value)
      return true
    } catch (error) {
      if (!(error instanceof TypeError)) {
        throw error
      }
      return false
    }
  }),
}
