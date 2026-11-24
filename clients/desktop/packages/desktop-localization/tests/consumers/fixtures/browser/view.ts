import { createTranslator } from '@kisaki3/desktop-localization'

const t = createTranslator('zh-CN', { library: { completion: { recorded: '<b>{name}</b>' } } })
document.body.textContent = t('library.completion.recorded', { name: '{literal}' })
document.body.dataset.ready = 'true'
