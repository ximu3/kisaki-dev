/** @fileoverview Uses published link and locale contracts in the browser document. */

import { parse, format } from '@kisaki3/desktop-contracts/deeplink'
import { parseUiLocale } from '@kisaki3/desktop-contracts/i18n'

const link = format(parse('kisaki://view/anime/external/bangumi/subject%2F123'))
const locale = parseUiLocale('zh-hans-cn')
document.querySelector('#summary')!.textContent = JSON.stringify({ link, locale })
document.body.dataset.ready = 'true'
