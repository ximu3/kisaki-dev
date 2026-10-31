/**
 * @fileoverview Provides complete light and dark token values while leaving font loading
 * and theme selection to the host.
 */

import type { VisualTokens } from './tokens'

/** Default light values; hosts own font loading and color-scheme selection. */
export const defaultLightTokens: Readonly<VisualTokens> = {
  '--background': 'oklch(0.965 0.005 256)',
  '--foreground': 'oklch(0.21 0.03 260)',
  '--surface': 'oklch(0.935 0.008 256)',
  '--surface-foreground': 'oklch(0.16 0.03 260)',
  '--popover': 'oklch(0.995 0.002 256)',
  '--popover-foreground': 'oklch(0.16 0.03 260)',
  '--dialog': 'oklch(0.995 0.002 256)',
  '--dialog-foreground': 'oklch(0.16 0.03 260)',

  '--primary': 'oklch(0.56 0.2 258)',
  '--primary-foreground': 'oklch(0.99 0.003 256)',
  '--secondary': 'oklch(0.32 0.02 258 / 0.07)',
  '--secondary-foreground': 'oklch(0.42 0.025 258)',
  '--muted': 'oklch(0.32 0.02 258 / 0.08)',
  '--muted-foreground': 'oklch(0.52 0.025 258)',
  '--accent': 'oklch(0.45 0.06 252 / 0.12)',
  '--accent-foreground': 'oklch(0.16 0.03 260)',

  '--input': 'transparent',
  '--input-foreground': 'oklch(0.16 0.03 260)',

  '--destructive': 'oklch(0.55 0.21 25)',
  '--destructive-foreground': 'oklch(0.99 0.003 256)',
  '--info': 'oklch(0.56 0.18 245)',
  '--info-foreground': 'oklch(0.99 0.003 256)',
  '--success': 'oklch(0.55 0.15 155)',
  '--success-foreground': 'oklch(0.99 0.003 256)',
  '--warning': 'oklch(0.7 0.14 75)',
  '--warning-foreground': 'oklch(0.22 0.03 80)',

  '--border': 'oklch(0.86 0.012 256)',
  '--ring': 'oklch(0.56 0.2 258)',
  '--chart': 'oklch(0.62 0.11 255)',

  '--radius': '6px',
  '--shadow-raised':
    '0 1px 2px 0 oklch(0.13 0.02 258 / 0.08), 0 3px 10px -2px oklch(0.13 0.02 258 / 0.1)',
  '--shadow-overlay':
    'inset 0 1px 0 oklch(1 0 0 / 0.5), inset 0 -1px 0 oklch(0.13 0.02 258 / 0.05), 0 1px 2px 0 oklch(0.13 0.02 258 / 0.1), 0 10px 24px -6px oklch(0.13 0.02 258 / 0.16)',
  '--shadow-modal':
    'inset 0 1px 0 oklch(1 0 0 / 0.55), inset 0 -1px 0 oklch(0.13 0.02 258 / 0.06), 0 2px 4px 0 oklch(0.13 0.02 258 / 0.1), 0 28px 64px -16px oklch(0.13 0.02 258 / 0.24)',

  '--pane-alpha': '72%',
  '--light-1': 'oklch(0.88 0.045 248)',
  '--light-2': 'oklch(0.9 0.03 260)',
  '--light-3': 'oklch(0.87 0.05 268)',
  '--light-strength': '50%',
  '--grain-opacity': '9%',

  '--font-sans': 'system-ui, sans-serif',
  '--font-mono': 'ui-monospace, monospace',
  '--text-base-size': '14px',
  '--text-base-weight': '450',
  '--text-base-line-height': '1.5',
  '--text-base-letter-spacing': 'normal',
}

/** Default dark values, using the same complete vocabulary. */
export const defaultDarkTokens: Readonly<VisualTokens> = {
  '--background': 'oklch(0.17 0.015 258)',
  '--foreground': 'oklch(0.9 0.012 256)',
  '--surface': 'oklch(0.15 0.015 258)',
  '--surface-foreground': 'oklch(0.9 0.012 256)',
  '--popover': 'oklch(0.24 0.02 258)',
  '--popover-foreground': 'oklch(0.9 0.012 256)',
  '--dialog': 'oklch(0.27 0.02 258)',
  '--dialog-foreground': 'oklch(0.9 0.012 256)',

  '--primary': 'oklch(0.64 0.17 256)',
  '--primary-foreground': 'oklch(0.985 0.005 256)',
  '--secondary': 'oklch(0.95 0.012 256 / 0.08)',
  '--secondary-foreground': 'oklch(0.8 0.012 256)',
  '--muted': 'oklch(0.95 0.012 256 / 0.09)',
  '--muted-foreground': 'oklch(0.72 0.015 256)',
  '--accent': 'oklch(0.85 0.06 252 / 0.16)',
  '--accent-foreground': 'oklch(0.97 0.005 256)',

  '--input': 'oklch(0.95 0.012 256 / 0.05)',
  '--input-foreground': 'oklch(0.9 0.012 256)',

  '--destructive': 'oklch(0.65 0.19 25)',
  '--destructive-foreground': 'oklch(0.985 0.005 256)',
  '--info': 'oklch(0.68 0.14 245)',
  '--info-foreground': 'oklch(0.15 0.02 258)',
  '--success': 'oklch(0.68 0.14 155)',
  '--success-foreground': 'oklch(0.15 0.02 258)',
  '--warning': 'oklch(0.75 0.14 80)',
  '--warning-foreground': 'oklch(0.22 0.03 80)',

  '--border': 'oklch(0.45 0.02 258 / 0.35)',
  '--ring': 'oklch(0.64 0.17 256)',
  '--chart': 'oklch(0.7 0.12 255)',

  '--radius': '6px',
  '--shadow-raised': '0 1px 2px 0 oklch(0 0 0 / 0.35), 0 4px 12px -2px oklch(0 0 0 / 0.4)',
  '--shadow-overlay':
    'inset 0 1px 0 oklch(1 0 0 / 0.08), inset 0 -1px 0 oklch(0 0 0 / 0.35), 0 1px 2px 0 oklch(0 0 0 / 0.45), 0 10px 24px -6px oklch(0 0 0 / 0.5)',
  '--shadow-modal':
    'inset 0 1px 0 oklch(1 0 0 / 0.1), inset 0 -1px 0 oklch(0 0 0 / 0.4), 0 2px 4px 0 oklch(0 0 0 / 0.5), 0 28px 64px -16px oklch(0 0 0 / 0.65)',

  '--pane-alpha': '75%',
  '--light-1': 'oklch(0.52 0.055 248)',
  '--light-2': 'oklch(0.56 0.04 260)',
  '--light-3': 'oklch(0.5 0.06 268)',
  '--light-strength': '45%',
  '--grain-opacity': '16%',

  '--font-sans': 'system-ui, sans-serif',
  '--font-mono': 'ui-monospace, monospace',
  '--text-base-size': '14px',
  '--text-base-weight': '450',
  '--text-base-line-height': '1.5',
  '--text-base-letter-spacing': 'normal',
}
