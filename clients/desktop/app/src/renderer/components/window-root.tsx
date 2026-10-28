/**
 * @fileoverview Shares the desktop window shell and presents failures from its
 * supplied close operation.
 */

import { createSignal, Show } from 'solid-js'
import { Button } from '@kisaki3/ui'
import './window-root.css'

interface WindowRootProps {
  title: string
  /** Request closure of the owning native window; rejection is displayed inline. */
  close(): Promise<void>
}

/** Render the native window shell and report a rejected close request. */
export function WindowRoot(props: WindowRootProps) {
  const [error, setError] = createSignal('')

  /** Forward the close request and keep its failure visible in this window. */
  async function closeWindow(): Promise<void> {
    try {
      await props.close()
    } catch {
      setError('This window could not be closed.')
    }
  }

  return (
    <main class="window-shell">
      <h1>{props.title}</h1>
      <Button onClick={() => void closeWindow()}>Close window</Button>
      <Show when={error()}>
        <p role="alert">{error()}</p>
      </Show>
    </main>
  )
}
