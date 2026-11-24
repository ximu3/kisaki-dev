import type { ControlSize } from '../control/size'

export type ActionVariant =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link'
  | 'text'

export type ActionSize = ControlSize | 'icon' | `icon-${Exclude<ControlSize, 'default'>}`
