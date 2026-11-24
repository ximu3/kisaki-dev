import { createSignal, onSettled, type Accessor } from 'solid-js'

export function createChartDuration(
  duration: Accessor<number | undefined>,
  fallback = 140,
): Accessor<number> {
  const [reduced, setReduced] = createSignal(false)
  onSettled(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const changed = () => setReduced(query.matches)
    changed()
    query.addEventListener('change', changed)
    return () => query.removeEventListener('change', changed)
  })

  return () => (reduced() ? 0 : (duration() ?? fallback))
}
