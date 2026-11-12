/** @fileoverview Shared outline glyph geometry and status symbols from Material Design Icons. */

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

/**
 * Renders a decorative MDI path in the shared glyph box.
 *
 * The enclosing control owns its accessible name and any size override.
 */
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

/** Renders the distinct outline symbol corresponding to a message's status. */
export function StatusIcon(props: {
  type: keyof typeof statusPaths
  class?: string | undefined
}): JSX.Element {
  return <Icon path={statusPaths[props.type]} class={props.class} />
}
