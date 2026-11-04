/** @fileoverview Publishes the preferences capability contract. */

export { parsePreferenceKey, parsePreferences, parsePreferencesUpdate, preferenceKeys } from './api'

export {
  parseAccelerator,
  parseShortcutPreferences,
  findShortcutConflicts,
  shortcutKeys,
} from './shortcuts'

export type {
  DesktopPlatform,
  ShortcutKey,
  ShortcutPreferences,
  ShortcutsPreferences,
  ShortcutConflict,
} from './shortcuts'

export {
  parseReadingPreferences,
  parseReadingPreferencesChanges,
  parseAnimePlaybackPreferences,
  parseReadingOverrideChange,
  parsePlaybackOverrideChange,
} from './usage'

export type {
  GamePreferences,
  AnimePlaybackPreferences,
  ReadingPagePreferences,
  ReadingTextPreferences,
  ReadingColors,
  ReadingPreferences,
  UsagePreferences,
  ReadingPreferencesChanges,
  UsagePreferencesChanges,
  UsageOverride,
  ReadingOverrideChange,
  PlaybackOverrideChange,
} from './usage'

export type {
  GeneralPreferences,
  NavigationPreferences,
  LibraryPreferences,
  PlaybackPreferences,
  UpdatePreferences,
  Preferences,
  PreferencesChanges,
  PreferencesExpected,
  PreferencesUpdate,
  ReadingPreferencesSnapshot,
  PreferencesSnapshot,
  ReadingPreferenceKey,
  PreferenceKey,
  PreferenceField,
  PreferencesApi,
} from './api'
