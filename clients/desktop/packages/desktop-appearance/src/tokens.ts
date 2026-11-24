export type TokenKind =
  | 'color'
  | 'radius'
  | 'shadow'
  | 'font-family'
  | 'font-size'
  | 'font-weight'
  | 'line-height'
  | 'letter-spacing'

export const tokens = Object.freeze({
  '--background': 'color',
  '--foreground': 'color',
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

export type TokenName = keyof typeof tokens

export type FontTokenName = '--font-sans' | '--font-mono'

export type VisualTokenName = Exclude<TokenName, FontTokenName>

export type TokenValues = Readonly<Record<TokenName, string>>

export type ColorScheme = 'light' | 'dark'
