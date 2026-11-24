import {
  preferenceKeys,
  shortcutKeys,
  type Preferences,
} from '@kisaki3/desktop-contracts/preferences'

type PreferenceGroup = keyof Preferences

const playbackFields = { volumePercent: true, muted: true } satisfies Record<
  keyof Preferences['playback'],
  true
>

function navigationPaths(group: PreferenceGroup) {
  const prefix = group + '.'
  return preferenceKeys
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length).split('.'))
}

export const storedPreferencePaths = {
  general: navigationPaths('general'),
  appearance: navigationPaths('appearance'),
  navigation: navigationPaths('navigation'),
  library: navigationPaths('library'),
  usage: navigationPaths('usage'),
  playback: Object.keys(playbackFields).map((key) => [key]),
  shortcuts: shortcutKeys.map((key) => [key]),
  network: navigationPaths('network').filter(([key]) => key !== 'credentials'),
  updates: navigationPaths('updates'),
} satisfies Record<PreferenceGroup, readonly (readonly string[])[]>

const selectionFields: ReadonlySet<string> = new Set([
  'general.uiTranslation',
  'appearance.theme',
  'navigation.order',
  'usage.comic.text.font',
  'usage.novel.text.font',
])

export function hasStoredDefinition(group: PreferenceGroup, path: readonly string[]) {
  return group === 'shortcuts' || selectionFields.has([group, ...path].join('.'))
}

export function readPreferenceField(value: unknown, path: readonly string[]): unknown {
  for (const key of path) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) {
      return undefined
    }
    value = (value as Record<string, unknown>)[key]
  }
  return value
}

export function setPreferenceField(
  target: Record<string, unknown>,
  path: readonly string[],
  value: unknown,
) {
  let parent = target
  for (const key of path.slice(0, -1)) {
    parent = (parent[key] ??= {}) as Record<string, unknown>
  }
  parent[path.at(-1)!] = value
}
