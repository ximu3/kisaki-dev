import { createMemo, Errored, Show, type Accessor } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { Alert } from '@kisaki3/desktop-ui/alert'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  type DialogContentProps,
} from '@kisaki3/desktop-ui/dialog'
import type { Translate } from '@kisaki3/desktop-localization'
import { errorMessage, reportError } from '../../../../infrastructure/notifications'
import type { ManagementPresentation, ManagementTarget } from './layer'

export interface ManagementScene<T extends ManagementTarget> {
  size: NonNullable<DialogContentProps['size']>
  fill?: boolean
  render: (presentation: ManagementPresentation<T>) => JSX.Element
}

/** Shows a scene or module-loading failure and allows the user to retry in place. */
export function ManagementFailure(props: { t: Translate; error: unknown; retry: () => void }) {
  const { t } = props

  return (
    <>
      <DialogHeader closeLabel={t('actions.close')}>
        <DialogTitle>{t('runtime.unavailable')}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <Alert tone="destructive" role="alert">
          {errorMessage(props.error)}
        </Alert>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={props.retry}>
          {t('runtime.retry')}
        </Button>
      </DialogFooter>
    </>
  )
}

/** Keeps each native dialog mounted through exit and acknowledges presentation on its open toggle. */
export function ManagementDialog<T extends ManagementTarget>(props: {
  t: Translate
  current: Accessor<ManagementPresentation<T> | undefined>
  scene: (target: T) => ManagementScene<T>
}) {
  return (
    <Show when={props.current()} keyed>
      {(presentation) => {
        // A selection change within the same scene updates its props without replacing its content.
        const scene = createMemo(() => props.scene(presentation.target()))

        function requestClose() {
          void presentation.requestClose().catch(reportError)
        }

        return (
          <Dialog
            open={presentation.open()}
            onOpenChange={(open) => {
              if (!open && presentation.open()) {
                requestClose()
              }
            }}
          >
            <DialogContent
              size={scene().size}
              fill={scene().fill ?? false}
              onToggle={(event) => {
                if (event.currentTarget.open) {
                  presentation.markPresented()
                }
              }}
              onCloseRequest={(event) => {
                event.preventDefault()
                requestClose()
              }}
            >
              <Errored
                fallback={(error, reset) => (
                  <ManagementFailure t={props.t} error={error()} retry={reset} />
                )}
              >
                {scene().render(presentation)}
              </Errored>
            </DialogContent>
          </Dialog>
        )
      }}
    </Show>
  )
}
