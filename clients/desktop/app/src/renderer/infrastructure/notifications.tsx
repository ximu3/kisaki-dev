import { Toaster, toast } from '@kisaki3/desktop-ui/toast'
import type { Translate } from '@kisaki3/desktop-localization'

export function Notifications(props: { t: Translate }) {
  return (
    <Toaster regionLabel={props.t('runtime.notifications')} closeLabel={props.t('actions.close')} />
  )
}

export function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

export function reportError(cause: unknown) {
  toast.show({ type: 'error', message: errorMessage(cause) })
}
