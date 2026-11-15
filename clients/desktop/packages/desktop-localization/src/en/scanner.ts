/** @fileoverview Defines English names and explanations for built-in clue-extraction presets. */

/** Canonical English names and explanations for scanner clue-extraction presets. */
export const scannerMessages = {
  presets: {
    bracketBoth: {
      name: 'Bracketed notes at both ends',
      description: 'Remove leading bracketed notes and one final bracketed note.',
    },
    multiBracketPrefix: {
      name: 'Multiple bracketed prefixes',
      description: 'Remove two or more leading bracketed notes if a title follows them.',
    },
    releaseYearSuffix: {
      name: 'Release year suffix',
      description:
        'Use a four-digit year in parentheses at the end of the name as the release year.',
    },
    versionSuffix: {
      name: 'Version suffix',
      description: 'Remove a trailing _v followed by a dotted version number, as in Title_v1.2.',
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
      description: 'Remove the final parenthesized note as plain text, even if it contains a year.',
    },
  },
} as const
