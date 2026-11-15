/** @fileoverview Loads the packed styles and pure values in a framework-free document. */

import '@kisaki3/desktop-appearance/styles.css'
import './utilities.css'
import './page.css'
import { defaults } from '@kisaki3/desktop-appearance/defaults'
import { tokens } from '@kisaki3/desktop-appearance/tokens'
import { parseTokenValues } from '@kisaki3/desktop-appearance/values'
import { summary } from './consumer.js'

/** Parsed light-theme token values applied to the real browser validation page. */
const values = parseTokenValues(defaults.light)

/** Native CSS property used to verify each token kind in the browser. */
const properties = {
  color: 'color',
  radius: 'border-radius',
  shadow: 'box-shadow',
  'font-family': 'font-family',
  'font-size': 'font-size',
  'font-weight': 'font-weight',
  'line-height': 'line-height',
  'letter-spacing': 'letter-spacing',
}

document.body.dataset.tokenCount = String(summary.count)
document.body.dataset.validCss = String(
  Object.entries(tokens).every(([name, kind]) =>
    CSS.supports(properties[kind], values[name as keyof typeof values]),
  ),
)
