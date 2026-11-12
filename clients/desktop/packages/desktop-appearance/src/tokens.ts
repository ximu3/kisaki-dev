/** @fileoverview Defines the complete, framework-independent visual vocabulary. */

/** The CSS value grammar assigned to one base appearance token. */
export type TokenKind =
  | 'color'
  | 'radius'
  | 'shadow'
  | 'font-family'
  | 'font-size'
  | 'font-weight'
  | 'line-height'
  | 'letter-spacing'

/** The fixed visual vocabulary; grouping and persistence belong to consumers. */
export const tokens = Object.freeze({
  '--background': 'color',
  '--foreground': 'color',
  /** Background for the application frame, navigation and control regions. */
  '--chrome': 'color',
  '--chrome-foreground': 'color',
  '--popover': 'color',
  '--popover-foreground': 'color',
  '--dialog': 'color',
  '--dialog-foreground': 'color',

  '--primary': 'color',
  '--primary-foreground': 'color',
  '--secondary': 'color',
  '--secondary-foreground': 'color',
  '--muted': 'color',
  '--muted-foreground': 'color',
  '--accent': 'color',
  '--accent-foreground': 'color',
  '--input': 'color',
  '--input-foreground': 'color',

  '--destructive': 'color',
  '--destructive-foreground': 'color',
  '--info': 'color',
  '--info-foreground': 'color',
  '--success': 'color',
  '--success-foreground': 'color',
  '--warning': 'color',
  '--warning-foreground': 'color',
  '--border': 'color',
  '--ring': 'color',

  '--chart-1': 'color',
  '--chart-2': 'color',
  '--chart-3': 'color',
  '--chart-4': 'color',
  '--chart-5': 'color',

  '--radius': 'radius',
  '--shadow-raised': 'shadow',
  '--shadow-overlay': 'shadow',
  '--shadow-modal': 'shadow',

  '--font-sans': 'font-family',
  '--font-mono': 'font-family',
  '--text-base-size': 'font-size',
  '--text-base-weight': 'font-weight',
  '--text-base-line-height': 'line-height',
  '--text-base-letter-spacing': 'letter-spacing',
} as const satisfies Record<string, TokenKind>)

/** Name of a base appearance token; host scale and derived CSS variables have separate owners. */
export type TokenName = keyof typeof tokens

/** Name of a font-family slot whose value is a CSS stack. */
export type FontTokenName = '--font-sans' | '--font-mono'

/** Name of a base appearance token other than the two font-family slots. */
export type VisualTokenName = Exclude<TokenName, FontTokenName>

/**
 * A complete read-only CSS-value branch for the base appearance vocabulary.
 *
 * External values are parsed through the values entry before adoption.
 */
export type TokenValues = Readonly<Record<TokenName, string>>

/** Resolved light or dark appearance branch, selected by the host. */
export type ColorScheme = 'light' | 'dark'
