import type { MessageCatalog, UiTranslation } from '@kisaki3/desktop-contracts/i18n'
import { developmentMessages } from './zh-hans'

export const developmentTranslation = {
  ref: { type: 'builtin', id: 'zh-Hans' },
  name: '简体中文',
  locale: 'zh-Hans',
  messages: developmentMessages,
} as const satisfies UiTranslation & { messages: MessageCatalog }
