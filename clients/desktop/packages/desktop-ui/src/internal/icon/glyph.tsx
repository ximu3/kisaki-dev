import {
  CircleExclamationPoint,
  TriangleExclamationPoint,
  CircleCheck,
  Info,
  type LucideIcon,
} from '@lucide/solid'
import { dynamic, type JSX } from '@solidjs/web'
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
  Keyboard,
  LoaderCircle,
  Search,
  Minus,
  ChevronsUpDown,
} from '@lucide/solid'

export function Icon(props: { icon: LucideIcon; class?: string | undefined }): JSX.Element {
  const Glyph = dynamic(() => props.icon)
  return (
    <Glyph
      size={24}
      strokeWidth={2}
      nonScalingStroke={false}
      color="currentColor"
      aria-hidden="true"
      class={classes(styles.glyph, props.class)}
    />
  )
}

const statusIcons = {
  info: Info,
  success: CircleCheck,
  warning: TriangleExclamationPoint,
  error: CircleExclamationPoint,
  destructive: CircleExclamationPoint,
}

export function StatusIcon(props: {
  type: keyof typeof statusIcons
  class?: string | undefined
}): JSX.Element {
  return <Icon icon={statusIcons[props.type]} class={props.class} />
}
