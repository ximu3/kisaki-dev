/** @fileoverview Consumes the packed desktop value and operation contracts with standard host APIs. */

import { parsePartialDate } from '@kisaki3/desktop-contracts/date'
import { parseEntryCreate } from '@kisaki3/desktop-contracts/library'
import { parseSourceEntry } from '@kisaki3/desktop-contracts/metadata'
import { parseUiTranslationRegistration } from '@kisaki3/desktop-contracts/i18n'
import { parse, format } from '@kisaki3/desktop-contracts/deeplink'
import { parseThemeRef } from '@kisaki3/desktop-contracts/appearance'
import { developmentProtocolVersion } from '@kisaki3/desktop-contracts/development'

export const summary = {
  date: parsePartialDate({ year: 2004 }),
  entryType: parseEntryCreate({ type: 'game', name: 'CLANNAD', evaluation: { rating: 90 } }).type,
  metadataType: parseSourceEntry({
    type: 'anime',
    identity: { source: 'bangumi', sourceId: '123' },
    identification: { name: 'Sample' },
  }).type,
  locale: parseUiTranslationRegistration({
    id: 'zh',
    name: '中文',
    locale: 'zh-hans-cn',
    messages: {},
  }).locale,
  link: format(parse('kisaki://view/anime/external/bangumi/subject%2F123')),
  theme: parseThemeRef({ type: 'builtin', id: 'default' }).type,
  protocol: developmentProtocolVersion,
}
