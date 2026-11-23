import type { JSX } from '@solidjs/web'
import { Button } from '@kisaki3/desktop-ui/button'
import { toast, type ToastHandle } from '@kisaki3/desktop-ui/toast'
import type {} from './api.js'

/**
 * Publishes synthetic loading messages and exposes retained handles for publisher-lifetime checks.
 */
export function ToastOwner(): JSX.Element {
  let handle: ToastHandle | undefined

  window.fixture.showLoading = (persistent) => {
    handle = toast.show(
      {
        type: 'loading',
        message: 'Preparing sample',
        action: {
          label: 'Inspect sample',

          onClick: () => {
            document.body.dataset.action = 'inspected'
          },
        },
      },
      { persistent },
    )
  }
  window.fixture.updateToast = () => handle?.update({ type: 'success', message: 'Sample ready' })
  window.fixture.dismissToast = () => handle?.dismiss()

  return (
    <Button variant="secondary" onClick={() => window.fixture.showLoading(false)}>
      Show loading
    </Button>
  )
}
