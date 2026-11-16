/** @fileoverview Displays the application's actual environment and copies only the requested shareable summary. */

import { createSignal, createResource, Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import type { MainClient } from '../../../infrastructure/api'

/** About information belongs to its own dialog and carries no private library state. */
export function About(props: { api: MainClient; report: (error: unknown) => void }) {
  const { api } = props
  /** Reads the actual application and operating-system versions. */
  const [info] = createResource(() => api.call('app.environment'))
  /** Shows clipboard success only after the copy has finished. */
  const [copied, setCopied] = createSignal(false)
  return (
    <article class="management">
      <h2>Kisaki</h2>
      <Show when={info()}>
        {(value) => (
          <>
            <p>{value().version}</p>
            <p>
              {value().operatingSystem.name} {value().operatingSystem.version} ·{' '}
              {value().architecture}
            </p>
          </>
        )}
      </Show>
      <p>AGPL-3.0-only</p>
      <Button
        variant="outline"
        onClick={() =>
          void api
            .call('app.copyEnvironment')
            .then(() => setCopied(true))
            .catch(props.report)
        }
      >
        {api.t('runtime.copyEnvironment')}
      </Button>
      <Show when={copied()}>
        <span role="status">{api.t('runtime.copied')}</span>
      </Show>
    </article>
  )
}
