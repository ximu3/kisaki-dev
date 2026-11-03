/** @fileoverview Consumes the published entrypoints and dependencies with the host's actual standard APIs. */

import { IntlMessageFormat } from 'intl-messageformat'
import { parsePartialDate } from '@kisaki3/desktop-contracts/date'
import { compareNaturalNames } from '@kisaki3/desktop-contracts/text'
import { parseEntryCreate } from '@kisaki3/desktop-contracts/library'
import { parseSourceEntry } from '@kisaki3/desktop-contracts/metadata'
import {
  englishMessages,
  getMessageParameterContract,
  validateMessageArguments,
} from '@kisaki3/desktop-contracts/i18n'
import { parse, format } from '@kisaki3/desktop-contracts/deeplink'
import { getDefaultTheme } from '@kisaki3/desktop-contracts/appearance'
import { developmentProtocolVersion } from '@kisaki3/desktop-contracts/development'

const message = englishMessages.library.selection
const values = validateMessageArguments(getMessageParameterContract(message), { count: 2 })

export const summary = {
  date: parsePartialDate({ year: 2004 }),
  entryType: parseEntryCreate({ type: 'game', name: 'CLANNAD', evaluation: { rating: 90 } }).type,
  order: compareNaturalNames('作品2', '作品10'),
  metadataType: parseSourceEntry({
    type: 'anime',
    identity: { source: 'bangumi', sourceId: '123' },
    identification: { name: 'Sample' },
  }).type,
  message: new IntlMessageFormat(message, 'en', undefined, { ignoreTag: true }).format(values),
  link: format(parse('kisaki://view/anime/external/bangumi/subject%2F123')),
  themeFont: getDefaultTheme().light['--font-sans'].type,
  protocol: developmentProtocolVersion,
}
