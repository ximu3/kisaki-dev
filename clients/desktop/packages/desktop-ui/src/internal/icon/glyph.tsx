/** @fileoverview Shares Lucide component presentation and status symbols across desktop controls. */

import { CircleExclamationPoint, TriangleExclamationPoint, CircleCheck, Info } from 'lucide-solid'
import type { LucideIcon } from 'lucide-solid'
import type { JSX } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { classes } from '../dom'
import styles from './styles.module.css'

export {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  X,
  GripVertical,
  LoaderCircle,
  Search,
  Minus,
  ChevronsUpDown,
} from 'lucide-solid'

/**
 * Renders a decorative Lucide component in the shared glyph box and follows icon changes.
 *
 * The enclosing control owns its accessible name and any size override.
 */
export function Icon(props: {
  /** Renders the selected Lucide glyph with the shared presentation props. */
  icon: LucideIcon
  class?: string | undefined
}): JSX.Element {
  return (
    <Dynamic
      component={props.icon}
      size={24}
      strokeWidth={2}
      nonScalingStroke={false}
      color="currentColor"
      aria-hidden="true"
      class={classes(styles.glyph, props.class)}
    />
  )
}

/** Semantic feedback states mapped to their shared decorative glyphs. */
const statusIcons = {
  info: Info,
  success: CircleCheck,
  warning: TriangleExclamationPoint,
  error: CircleExclamationPoint,
  destructive: CircleExclamationPoint,
}

/** Renders the distinct outline symbol corresponding to a message's status. */
export function StatusIcon(props: {
  type: keyof typeof statusIcons
  class?: string | undefined
}): JSX.Element {
  return <Icon icon={statusIcons[props.type]} class={props.class} />
}
