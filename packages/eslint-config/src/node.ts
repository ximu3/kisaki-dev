import type { Linter } from 'eslint'

/** Restrict browser globals in Node code even when upstream declarations reference DOM types. */
export default {
  rules: {
    'no-restricted-globals': [
      'error',
      'window',
      'document',
      'navigator',
      'localStorage',
      'sessionStorage',
      'HTMLElement',
      'requestAnimationFrame',
    ],
  },
} satisfies Linter.Config
