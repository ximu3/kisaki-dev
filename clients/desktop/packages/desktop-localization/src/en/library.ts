/** @fileoverview Defines English names and feedback for library entries and personal records. */

export const libraryMessages = {
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
} as const
