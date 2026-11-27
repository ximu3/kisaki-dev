import { expect, test } from 'vite-plus/test'
import { formatPreferencePath } from './preferences'
import { createTranslator } from './translate'

test('preference paths distinguish fields with the same name and share reading and shortcut labels', () => {
  const t = createTranslator('en')
  expect(formatPreferencePath(t, 'network.mode')).toEqual(['Network', 'Proxy mode'])
  expect(formatPreferencePath(t, 'appearance.mode')).toEqual(['Appearance', 'Theme mode'])
  for (const [key, medium] of [
    ['usage.comic.text.font', 'Comics'],
    ['usage.novel.text.font', 'Novels'],
  ] as const) {
    expect(formatPreferencePath(t, key)).toEqual([
      'Using works',
      medium,
      'Reflowable text',
      'Text font',
    ])
  }
  expect(formatPreferencePath(t, 'shortcuts.game.viewWork')).toEqual([
    'Keyboard shortcuts',
    'Game panel',
    'View work',
  ])
})
