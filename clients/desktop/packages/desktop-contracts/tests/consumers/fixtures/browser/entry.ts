/** @fileoverview Uses published link and locale contracts in the browser document. */

import { parse, format } from '@kisaki3/desktop-contracts/deeplink'
import { parseUiLocale } from '@kisaki3/desktop-contracts/i18n'

/** Round-tripped external-identity deeplink exposed for the browser consumer assertion. */
const link = format(parse('kisaki://view/anime/external/bangumi/subject%2F123'))

/** Canonicalized locale used by the packed browser-consumer check. */
const locale = parseUiLocale('zh-hans-cn')
document.querySelector('#summary')!.textContent = JSON.stringify({ link, locale })
document.body.dataset.ready = 'true'
