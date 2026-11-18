/** @fileoverview Installs the notification region for one connected native document. */

import { Toaster, toast } from '@kisaki3/desktop-ui/toast'
import type { Translate } from '@kisaki3/desktop-localization'

/** Mounts this document's message queue with its active language. */
export function Notifications(props: { t: Translate }) {
  return (
    <Toaster regionLabel={props.t('runtime.notifications')} closeLabel={props.t('actions.close')} />
  )
}

/** Extracts the diagnostic delivered by a window operation for local feedback. */
export function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

/** Reports one operation failure in the initiating document. */
export function reportError(cause: unknown) {
  toast.show({ type: 'error', message: errorMessage(cause) })
}
