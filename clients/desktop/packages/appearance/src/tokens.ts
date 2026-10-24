/** The fixed vocabulary shared by native windows and extension documents. */
export const appearanceTokenNames = [
  '--background',
  '--foreground',
  '--surface',
  '--surface-foreground',
  '--popover',
  '--popover-foreground',
  '--dialog',
  '--dialog-foreground',

  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',

  '--input',
  '--input-foreground',

  '--destructive',
  '--destructive-foreground',
  '--info',
  '--info-foreground',
  '--success',
  '--success-foreground',
  '--warning',
  '--warning-foreground',

  '--border',
  '--ring',
  '--chart',

  '--radius',
  '--shadow-raised',
  '--shadow-overlay',
  '--shadow-modal',

  '--pane-alpha',
  '--light-1',
  '--light-2',
  '--light-3',
  '--light-strength',
  '--grain-opacity',

  '--font-sans',
  '--font-mono',
  '--text-base-size',
  '--text-base-weight',
  '--text-base-line-height',
  '--text-base-letter-spacing',
] as const

/** A visual CSS token, independent of desktop fonts and resource identities. */
export type AppearanceTokenName = (typeof appearanceTokenNames)[number]

/** Complete, resolved CSS values for one color scheme. */
export type VisualTokens = Record<AppearanceTokenName, string>
