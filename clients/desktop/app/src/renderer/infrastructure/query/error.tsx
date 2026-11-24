import { Show } from 'solid-js'
import { Alert } from '@kisaki3/desktop-ui/alert'
import { Button } from '@kisaki3/desktop-ui/button'
import { errorMessage } from '../notifications'

export function QueryError(props: {
  error: unknown
  retryLabel: string
  retry: () => void
  class?: string
}) {
  return (
    <Show when={props.error}>
      {(cause) => (
        <Alert tone="destructive" role="alert" class={props.class}>
          {errorMessage(cause())}{' '}
          <Button variant="outline" onClick={props.retry}>
            {props.retryLabel}
          </Button>
        </Alert>
      )}
    </Show>
  )
}
