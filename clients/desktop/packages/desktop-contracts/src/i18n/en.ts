/** @fileoverview Owns the English source messages used to generate desktop message keys and argument contracts. */

/** Add messages with the capability that owns their meaning; translator contracts are generated from these ICU leaves. */
export const englishMessages = {
  actions: {
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    create: 'Create',
    delete: 'Delete',
    retry: 'Retry',
    edit: 'Edit',
    open: 'Open',
  },

  library: {
    types: {
      game: 'Game',
      anime: 'Anime',
      comic: 'Comic',
      novel: 'Novel',
      character: 'Character',
      person: 'Person',
      organization: 'Organization',
    },
    parts: {
      novelVolume: 'Volume',
      comicVolume: 'Volume',
      comicChapter: 'Chapter',
      animeEpisode: 'Episode',
      animeExtra: 'Extra',
    },
    status: { planned: 'Planned', active: 'In progress', onHold: 'On hold', unset: 'Not set' },
    selection: '{count, plural, one {# item selected} other {# items selected}}',
    noMatch: 'No matching items in the current visible scope.',
    conflict: 'The saved values have changed. Review your changes before saving again.',
    completion: { recorded: 'Completion recorded for {name}.', unknownDate: 'Date not recorded' },
  },

  tasks: {
    running: 'Running',
    pausing: 'Pausing',
    paused: 'Paused',
    cancelling: 'Cancelling',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
    interrupted: 'Interrupted',
  },

  resources: {
    unavailable: 'The saved content is unavailable.',
    captureUnavailable: 'The requested image could not be captured.',
  },

  scanner: {
    presets: {
      bracketBoth: {
        name: 'Bracketed notes at both ends',
        description: 'Remove leading bracketed notes and one final bracketed note.',
      },
      multiBracketPrefix: {
        name: 'Multiple bracketed prefixes',
        description: 'Remove at least two leading bracketed notes; a real title must remain.',
      },
      releaseYearSuffix: {
        name: 'Release year suffix',
        description: 'Interpret a final four-digit parenthesized year as the release year.',
      },
      versionSuffix: {
        name: 'Version suffix',
        description: 'Remove a final underscore followed by a v-prefixed dotted numeric version.',
      },
      languageSuffix: {
        name: 'Language suffix',
        description:
          'Remove a final CHS, CHT, JP, EN, KR, SC or TC suffix without changing metadata language.',
      },
      bracketPrefix: {
        name: 'Single bracketed prefix',
        description: 'Remove only the first leading bracketed note.',
      },
      parenPrefix: {
        name: 'Single parenthesized prefix',
        description: 'Remove only the first leading parenthesized note.',
      },
      bracketSuffix: {
        name: 'Single bracketed suffix',
        description: 'Remove only the final bracketed note.',
      },
      parenSuffix: {
        name: 'Single parenthesized suffix',
        description: 'Remove a final ordinary parenthesized note without interpreting a date.',
      },
    },
  },

  showcase: {
    presets: {
      recentlyUsed: {
        name: 'Recently used',
        description: 'Works with recorded activity, most recently used first.',
      },
      active: { name: 'In progress', description: 'Works currently marked as in progress.' },
      planned: {
        name: 'Planned',
        description: 'Works you plan to use, most recently added first.',
      },
      recentlyAdded: {
        name: 'Recently added',
        description: 'All works ordered by their effective added date.',
      },
      favoriteWorks: {
        name: 'Favorite works',
        description: 'Your favorite games, anime, comics and novels.',
      },
      rating: {
        name: 'Personal ratings',
        description: 'Rated works, highest personal rating first.',
      },
      favoriteCharacters: { name: 'Favorite characters', description: 'Your favorite characters.' },
      favoritePersons: { name: 'Favorite people', description: 'Your favorite people.' },
      favoriteOrganizations: {
        name: 'Favorite organizations',
        description: 'Your favorite organizations.',
      },
      collections: { name: 'Collections', description: 'Collections in their saved order.' },
    },
  },
} as const
