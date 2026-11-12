/** @fileoverview Defines English names and explanations for built-in clue-extraction presets. */

export const scannerMessages = {
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
} as const
