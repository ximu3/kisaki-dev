/** @fileoverview Chart animation clocks follow the document motion preference. */

import { createSignal, onCleanup, onMount } from 'solid-js'
import type { Accessor } from 'solid-js'

/**
 * Creates a duration accessor that becomes zero while reduced motion is requested.
 *
 * Durations are milliseconds; the media-query listener is released with the Solid owner.
 */
export function createChartDuration(
  duration: Accessor<number | undefined>,
  fallback = 140,
): Accessor<number> {
  const [reduced, setReduced] = createSignal(false)
  onMount(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    /** Updates the duration preference from the current media-query match. */
    const changed = () => setReduced(query.matches)
    changed()
    query.addEventListener('change', changed)
    onCleanup(() => query.removeEventListener('change', changed))
  })

  return () => (reduced() ? 0 : (duration() ?? fallback))
}
