/** @fileoverview Chart animation clocks follow the document motion preference. */

import { createSignal, onCleanup, onMount } from 'solid-js'
import type { Accessor } from 'solid-js'

/** Data changes are brief; pointer-following components supply a zero-duration default. */
export function createChartDuration(
  duration: Accessor<number | undefined>,
  fallback = 140,
): Accessor<number> {
  const [reduced, setReduced] = createSignal(false)
  onMount(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const changed = () => setReduced(query.matches)
    changed()
    query.addEventListener('change', changed)
    onCleanup(() => query.removeEventListener('change', changed))
  })

  return () => (reduced() ? 0 : (duration() ?? fallback))
}
