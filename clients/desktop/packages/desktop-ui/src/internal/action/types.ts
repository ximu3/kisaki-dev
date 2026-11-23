import type { ControlSize } from '../control/size'

/**
 * Shared visual emphasis for an action or link, independent of its native interaction semantics.
 */
export type ActionVariant =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link'
  | 'text'

/**
 * Action geometry preset following interface scale, with square hit areas for icon-only variants.
 */
export type ActionSize = ControlSize | 'icon' | `icon-${Exclude<ControlSize, 'default'>}`
