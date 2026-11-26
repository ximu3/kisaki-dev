import '@kisaki3/desktop-appearance/styles.css'
import './utilities.css'
import './page.css'
import { defaults } from '@kisaki3/desktop-appearance/defaults'
import { tokens } from '@kisaki3/desktop-appearance/tokens'
import { parseTokenValue, parseTokenValues } from '@kisaki3/desktop-appearance/values'

const values = parseTokenValues(defaults.light)

const properties = {
  color: 'color',
  radius: 'border-radius',
  shadow: 'box-shadow',
  'font-family': 'font-family',
  'font-weight': 'font-weight',
  'line-height': 'line-height',
  'letter-spacing': 'letter-spacing',
}

document.body.dataset.validCss = String(
  Object.entries(tokens).every(([name, kind]) =>
    CSS.supports(properties[kind], values[name as keyof typeof values]),
  ),
)

document.body.dataset.zeroRadius = parseTokenValue('--radius', '0')
