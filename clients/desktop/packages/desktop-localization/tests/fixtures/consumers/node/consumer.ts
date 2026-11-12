/** @fileoverview Consumes only the packed localization entrypoint and its declared runtime dependencies. */

import {
  createTranslator,
  validateExtensionUiTranslationDefinition,
} from '@kisaki3/desktop-localization'

export const summary = {
  english: createTranslator('en')('library.selection', { count: 2 }),
  translated: createTranslator('zh-CN', { actions: { save: '保存' } })('actions.save'),
  fallback: createTranslator('zh-CN')('library.selection', { count: 2 }),
  literal: createTranslator('en', { library: { completion: { recorded: '<b>{name}</b>' } } })(
    'library.completion.recorded',
    { name: '{literal}' },
  ),
  locale: validateExtensionUiTranslationDefinition({
    id: 'zh',
    name: '中文',
    locale: 'zh-hans-cn',
    messages: {},
  }).locale,
}
