/** @fileoverview Shared visual purposes and sizes for actions and navigation links. */

/**
 * Shared visual emphasis for an action or link, independent of its native interaction semantics.
 */
export type ActionVariant =
  'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'text'

/**
 * Action geometry preset following interface scale, with square hit areas for icon-only variants.
 */
export type ActionSize = 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'
