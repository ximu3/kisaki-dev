import type {
  PreferenceKey,
  ReadingPreferenceKey,
  ShortcutKey,
} from '@kisaki3/desktop-contracts/preferences'
import type { Translate } from './contracts.generated'

type Parts<K> = K extends `${infer Scope}.${infer Command}` ? [Scope, Command] : never

const scopeMessages = {
  main: 'application.windows.main',
  editor: 'shortcuts.editor',
  reader: 'application.windows.reader',
  player: 'application.windows.player',
  game: 'application.windows.gamePanel',
} as const satisfies Record<Parts<ShortcutKey>[0], string>

export function formatShortcutScope(t: Translate, scope: Parts<ShortcutKey>[0]): string {
  return t(scopeMessages[scope])
}

function isShortcut(key: PreferenceKey): key is `shortcuts.${ShortcutKey}` {
  return key.startsWith('shortcuts.')
}

function isReading(
  key: PreferenceKey,
): key is `usage.${'comic' | 'novel'}.${ReadingPreferenceKey}` {
  return key.startsWith('usage.comic.') || key.startsWith('usage.novel.')
}

function afterGroup<K extends string>(key: K) {
  return key.slice(key.indexOf('.') + 1) as K extends `${string}.${infer Rest}` ? Rest : never
}

export function formatPreferenceField(t: Translate, key: PreferenceKey): string {
  if (isShortcut(key)) {
    return t(`shortcuts.commands.${afterGroup(afterGroup(key))}`)
  }
  if (isReading(key)) {
    return t(`preferences.reading.${afterGroup(afterGroup(key))}`)
  }
  return t(`preferences.${key}`)
}

type Segments<K extends string> = K extends `${infer Head}.${infer Rest}`
  ? [Head, ...Segments<Rest>]
  : [K]

export function formatPreferencePath(t: Translate, key: PreferenceKey): readonly string[] {
  const parts = key.split('.') as Segments<PreferenceKey>
  const labels = [t(`preferences.sections.${parts[0]}`)]
  if (parts[0] === 'shortcuts') {
    labels.push(formatShortcutScope(t, parts[1]))
  } else if (parts[0] === 'usage' && parts[2] !== undefined) {
    labels.push(t(`preferences.usage.media.${parts[1]}`))
    if (parts.length === 4) {
      labels.push(t(`preferences.reading.${parts[2]}.title`))
    }
  }
  return [...labels, formatPreferenceField(t, key)]
}
