/** @fileoverview Defines the complete, framework-independent visual vocabulary. */

/** Value grammars describe one CSS value, without declarations or resource references. */
export type TokenKind =
  | 'color'
  | 'opaque-color'
  | 'radius'
  | 'shadow'
  | 'font-family'
  | 'font-size'
  | 'font-weight'
  | 'line-height'
  | 'letter-spacing'

/** The complete visual vocabulary, shared by theme definitions and document styles. */
export const tokens = Object.freeze({
  '--background': 'opaque-color',
  '--foreground': 'color',
  '--chrome': 'opaque-color',
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

/** A base token, excluding runtime scale and derived CSS variables. */
export type TokenName = keyof typeof tokens

/** Font slots contain CSS stacks here; desktop resource selections are defined elsewhere. */
export type FontTokenName = '--font-sans' | '--font-mono'

/** All visual slots other than the two font stacks. */
export type VisualTokenName = Exclude<TokenName, FontTokenName>

/** A complete visual branch; parse external strings through the values entry before adoption. */
export type TokenValues = Readonly<Record<TokenName, string>>

/** The resolved light or dark branch; system preference resolution belongs to the host. */
export type ColorScheme = 'light' | 'dark'
