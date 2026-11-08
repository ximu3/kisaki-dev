/** @fileoverview Shared outline icon geometry and status symbols from Material Design Icons. */

import {
  mdiAlertCircleOutline,
  mdiAlertOutline,
  mdiCheckCircleOutline,
  mdiInformationOutline,
} from '@mdi/js'
import type { JSX } from 'solid-js'
import { classes } from '../dom'
import styles from './styles.module.css'

export {
  mdiAlertCircleOutline,
  mdiCalendarOutline,
  mdiCheck,
  mdiChevronDown,
  mdiChevronLeft,
  mdiChevronRight,
  mdiChevronUp,
  mdiClose,
  mdiDrag,
  mdiLoading,
  mdiMagnify,
  mdiMinus,
  mdiUnfoldMoreHorizontal,
} from '@mdi/js'

/** The enclosing control owns the accessible name and selects a glyph size when needed. */
export function Icon(props: { path: string; class?: string | undefined }): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      class={classes(styles.glyph, props.class)}
    >
      <path d={props.path} />
    </svg>
  )
}

const statusPaths = {
  info: mdiInformationOutline,
  success: mdiCheckCircleOutline,
  warning: mdiAlertOutline,
  error: mdiAlertCircleOutline,
  destructive: mdiAlertCircleOutline,
}

/** Status meaning is carried by both the message and its distinct outline symbol. */
export function StatusIcon(props: {
  type: keyof typeof statusPaths
  class?: string | undefined
}): JSX.Element {
  return <Icon path={statusPaths[props.type]} class={props.class} />
}
