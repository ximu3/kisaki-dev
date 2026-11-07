/** @fileoverview Shared visual purposes and sizes for actions and navigation links. */

/** Visual purpose; navigation remains the Link family's responsibility. */
export type ActionVariant =
  'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'text'

/** Heights follow the inherited interface scale; icon sizes retain a square hit area. */
export type ActionSize = 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'
