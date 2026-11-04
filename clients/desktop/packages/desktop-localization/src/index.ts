/** @fileoverview Publishes the English author baseline, typed calls, validation and pure formatting. */

export { englishMessages } from './en/index'
export type {
  MessageArguments,
  MessageKey,
  TranslationCall,
  Translate,
} from './contracts.generated'
export type { MessageCatalog } from '@kisaki3/desktop-contracts/i18n'
export {
  flattenMessages,
  getMessageParameterContract,
  getMessageContracts,
  validateMessageCatalog,
  validateMessageArguments,
} from './messages'
export type { MessageArgumentKind, MessageParameterContract, MessageContracts } from './messages'
export { createTranslator, validateUiTranslation } from './translate'
