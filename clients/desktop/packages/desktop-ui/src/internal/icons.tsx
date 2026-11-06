/** @fileoverview Shared outline icon geometry and status symbols from Material Design Icons. */

import {
  mdiAlertCircleOutline,
  mdiAlertOutline,
  mdiCheckCircleOutline,
  mdiInformationOutline,
} from '@mdi/js'
import type { JSX } from 'solid-js'

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
  mdiMinus,
} from '@mdi/js'

/** Decorative symbols inherit text color and size; the enclosing control owns its name. */
export function Icon(props: { path: string; class?: string | undefined }): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
      class={props.class}
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
