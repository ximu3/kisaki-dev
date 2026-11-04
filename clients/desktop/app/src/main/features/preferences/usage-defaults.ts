/** @fileoverview Creates complete native game, playback and reading defaults. */

import type {
  ReadingPreferences,
  AnimePlaybackPreferences,
  UsagePreferences,
} from '@kisaki3/desktop-contracts/preferences'

/** A fresh complete default for either reading medium; callers keep comic and novel selections independently. */
export function getReadingDefaults(): ReadingPreferences {
  return {
    flow: 'paginated',
    pages: {
      arrangement: 'single',
      progression: 'document',
      firstPage: 'single',

      fit: 'page',
      autoCrop: false,
      brightness: 1,
      contrast: 1,
    },
    text: {
      pagesPerView: 1,
      writingMode: 'document',

      font: { type: 'document' },
      fontSize: 20,
      lineHeight: 1.8,
      paragraphSpacing: 'document',
      alignment: 'document',

      padding: 24,
      maxLineLength: 36,
    },
    colors: { type: 'theme' },
  }
}

/** A fresh playback configuration, independent of remembered volume/mute and any opened file. */
export function getAnimePlaybackDefaults(): AnimePlaybackPreferences {
  return {
    audioLanguages: [],
    subtitleLanguages: [],
    subtitlesEnabled: true,

    playbackSpeed: 1,
    subtitleScale: 1,

    autoAdvance: false,
    autoMarkWatched: true,
  }
}

/** All four medium defaults and the single shared foreground grace interval. */
export function getUsageDefaults(): UsagePreferences {
  return {
    foregroundGracePeriodMs: 600_000,
    game: { showPanelOnStart: false, panelAlwaysOnTop: true },
    anime: getAnimePlaybackDefaults(),
    comic: getReadingDefaults(),
    novel: getReadingDefaults(),
  }
}
