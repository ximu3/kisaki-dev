import { createTranslator } from '@kisaki3/desktop-localization'

const t = createTranslator('zh-Hans', { actions: { save: '保存' } })
document.querySelector('#summary')!.textContent = JSON.stringify({
  translated: t('actions.save'),
  fallback: t('library.selection', { count: 2 }),
})
document.body.dataset.ready = 'true'
