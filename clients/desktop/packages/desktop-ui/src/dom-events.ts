/** @fileoverview Schedules controlled updates after the browser and all native event listeners finish. */

import { onCleanup } from 'solid-js'

/** Coalesce pending updates in the current owner and cancel them on disposal. */
export function afterEvent(update: () => void): () => void {
  let task: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(task))
  return () => {
    clearTimeout(task)
    task = setTimeout(update, 0)
  }
}
