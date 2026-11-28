import {
  mdiAlertCircleOutline,
  mdiAlertOutline,
  mdiCheckCircleOutline,
  mdiInformationOutline,
} from '@mdi/js'
import type { JSX } from '@solidjs/web'
import { Icon } from '../components/icon'

const statusIcons = {
  info: mdiInformationOutline,
  success: mdiCheckCircleOutline,
  warning: mdiAlertOutline,
  error: mdiAlertCircleOutline,
  destructive: mdiAlertCircleOutline,
}

export function StatusIcon(props: {
  type: keyof typeof statusIcons
  class?: string | undefined
}): JSX.Element {
  return <Icon path={statusIcons[props.type]} class={props.class} />
}
