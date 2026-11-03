/** @fileoverview Formats the same public ICU argument contract in an independent browser document. */

import { IntlMessageFormat } from 'intl-messageformat'
import {
  getMessageParameterContract,
  validateMessageArguments,
} from '@kisaki3/desktop-contracts/i18n'

const message = '<b>{text}</b> · {count, number}'
const values = validateMessageArguments(getMessageParameterContract(message), {
  text: '{literal}',
  count: 2,
})
document.body.textContent = String(
  new IntlMessageFormat(message, 'en', undefined, { ignoreTag: true }).format(values),
)
document.body.dataset.ready = 'true'
