/**
 * @fileoverview Provides complete light and dark token values while leaving font loading
 * and theme selection to the host.
 */

import type { VisualTokens } from './tokens'

/** Default light values; hosts own font loading and color-scheme selection. */
export const defaultLightTokens: Readonly<VisualTokens> = {
  '--background': 'oklch(0.985 0.002 260)',
  '--foreground': 'oklch(0.22 0.015 260)',
  '--surface': 'oklch(1 0 0)',
  '--surface-foreground': 'oklch(0.22 0.015 260)',
  '--popover': 'oklch(1 0 0)',
  '--popover-foreground': 'oklch(0.22 0.015 260)',
  '--dialog': 'oklch(1 0 0)',
  '--dialog-foreground': 'oklch(0.22 0.015 260)',

  '--primary': 'oklch(0.53 0.17 256)',
  '--primary-foreground': 'oklch(0.99 0 0)',
  '--secondary': 'oklch(0.94 0.01 260)',
  '--secondary-foreground': 'oklch(0.3 0.02 260)',
  '--muted': 'oklch(0.95 0.005 260)',
  '--muted-foreground': 'oklch(0.5 0.02 260)',
  '--accent': 'oklch(0.93 0.03 256)',
  '--accent-foreground': 'oklch(0.3 0.06 256)',

  '--input': 'oklch(1 0 0)',
  '--input-foreground': 'oklch(0.22 0.015 260)',

  '--destructive': 'oklch(0.55 0.2 25)',
  '--destructive-foreground': 'white',
  '--info': 'oklch(0.53 0.17 256)',
  '--info-foreground': 'white',
  '--success': 'oklch(0.48 0.13 155)',
  '--success-foreground': 'white',
  '--warning': 'oklch(0.76 0.15 80)',
  '--warning-foreground': 'oklch(0.25 0.04 70)',

  '--border': 'oklch(0.88 0.01 260)',
  '--ring': 'oklch(0.53 0.17 256)',
  '--chart': 'oklch(0.53 0.17 256)',

  '--radius': '6px',
  '--shadow-raised': '0 2px 8px rgb(0 0 0 / 0.06)',
  '--shadow-overlay': '0 8px 24px rgb(0 0 0 / 0.12)',
  '--shadow-modal': '0 16px 48px rgb(0 0 0 / 0.18)',

  '--pane-alpha': '0.95',
  '--light-1': 'oklch(0.9 0.04 256)',
  '--light-2': 'oklch(0.94 0.03 300)',
  '--light-3': 'oklch(0.96 0.02 230)',
  '--light-strength': '0.15',
  '--grain-opacity': '0.025',

  '--font-sans': 'system-ui, sans-serif',
  '--font-mono': 'ui-monospace, monospace',
  '--text-base-size': '14px',
  '--text-base-weight': '400',
  '--text-base-line-height': '1.5',
  '--text-base-letter-spacing': 'normal',
}

/** Default dark values, using the same complete vocabulary. */
export const defaultDarkTokens: Readonly<VisualTokens> = {
  '--background': 'oklch(0.17 0.015 258)',
  '--foreground': 'oklch(0.9 0.012 256)',
  '--surface': 'oklch(0.21 0.015 258)',
  '--surface-foreground': 'oklch(0.9 0.012 256)',
  '--popover': 'oklch(0.23 0.015 258)',
  '--popover-foreground': 'oklch(0.9 0.012 256)',
  '--dialog': 'oklch(0.21 0.015 258)',
  '--dialog-foreground': 'oklch(0.9 0.012 256)',

  '--primary': 'oklch(0.64 0.17 256)',
  '--primary-foreground': 'oklch(0.15 0.03 256)',
  '--secondary': 'oklch(0.28 0.02 258)',
  '--secondary-foreground': 'oklch(0.9 0.012 256)',
  '--muted': 'oklch(0.25 0.015 258)',
  '--muted-foreground': 'oklch(0.7 0.02 256)',
  '--accent': 'oklch(0.85 0.06 252 / 0.16)',
  '--accent-foreground': 'oklch(0.9 0.012 256)',

  '--input': 'oklch(0.19 0.015 258)',
  '--input-foreground': 'oklch(0.9 0.012 256)',

  '--destructive': 'oklch(0.55 0.2 25)',
  '--destructive-foreground': 'white',
  '--info': 'oklch(0.53 0.17 256)',
  '--info-foreground': 'white',
  '--success': 'oklch(0.48 0.13 155)',
  '--success-foreground': 'white',
  '--warning': 'oklch(0.76 0.15 80)',
  '--warning-foreground': 'oklch(0.25 0.04 70)',

  '--border': 'oklch(0.34 0.02 258)',
  '--ring': 'oklch(0.64 0.17 256)',
  '--chart': 'oklch(0.53 0.17 256)',

  '--radius': '6px',
  '--shadow-raised': '0 2px 8px rgb(0 0 0 / 0.06)',
  '--shadow-overlay': '0 8px 24px rgb(0 0 0 / 0.12)',
  '--shadow-modal': '0 16px 48px rgb(0 0 0 / 0.18)',

  '--pane-alpha': '0.95',
  '--light-1': 'oklch(0.9 0.04 256)',
  '--light-2': 'oklch(0.94 0.03 300)',
  '--light-3': 'oklch(0.96 0.02 230)',
  '--light-strength': '0.15',
  '--grain-opacity': '0.025',

  '--font-sans': 'system-ui, sans-serif',
  '--font-mono': 'ui-monospace, monospace',
  '--text-base-size': '14px',
  '--text-base-weight': '400',
  '--text-base-line-height': '1.5',
  '--text-base-letter-spacing': 'normal',
}
