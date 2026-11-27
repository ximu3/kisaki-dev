import { Toaster, toast } from '@kisaki3/desktop-ui/toast'
import type { Translate } from '@kisaki3/desktop-localization'
import { createEffect, type Accessor } from 'solid-js'
import type { PresentationIssue } from './appearance'

export function appearanceIssueMessage(t: Translate, issue: PresentationIssue): string {
  if (issue === 'theme') {
    return t('appearance.themeUnavailable')
  }
  const slot = issue === '--font-sans' ? 'font-sans' : 'font-mono'
  return t('appearance.fontUnavailable', { slot: t(`themes.tokens.${slot}`) })
}

export function Notifications(props: {
  t: Translate
  appearanceIssues?: Accessor<readonly PresentationIssue[]>
}) {
  createEffect(
    () => props.appearanceIssues?.() ?? [],
    (issues, previous = []) => {
      for (const issue of issues) {
        if (!previous.includes(issue)) {
          toast.show({ type: 'warning', message: appearanceIssueMessage(props.t, issue) })
        }
      }
    },
  )
  return (
    <Toaster
      regionLabel={props.t('controls.feedback.notifications')}
      closeLabel={props.t('actions.close')}
    />
  )
}

export function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

export function reportError(cause: unknown) {
  toast.show({ type: 'error', message: errorMessage(cause) })
}
