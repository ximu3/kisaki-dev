import { onCleanup } from 'solid-js'

/** Viewport coordinate in CSS pixels used by submenu pointer geometry. */
interface Point {
  x: number
  y: number
}

/**
 * Creates delayed submenu hover intent with a protected pointer corridor.
 *
 * The current timer and transit listener are released with the Solid owner; keyboard opening
 * remains owned by the menu.
 */
export function createSubmenuHover(options: {
  anchor: () => HTMLElement | undefined
  /** Returns the submenu surface whose near edge defines the pointer corridor. */
  content: () => HTMLElement | undefined
  isOpen: () => boolean
  open: () => void
  close: () => void
}) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let release: (() => void) | undefined
  let transit = false

  const stop = () => {
    clearTimeout(timer)
    release?.()
    release = undefined
    transit = false
  }

  const close = () => {
    stop()
    options.close()
  }
  onCleanup(stop)

  return {
    inTransit: () => transit,
    stop,
    enter: () => {
      stop()
      if (!options.isOpen()) {
        timer = setTimeout(options.open, 120)
      }
    },
    // Allow diagonal pointer movement from the trigger into its submenu.
    leave: (event: PointerEvent) => {
      stop()
      if (!options.isOpen()) {
        return
      }

      const content = options.content()!
      const rect = content.getBoundingClientRect()
      const edge = event.clientX < rect.x + rect.width / 2 ? rect.left : rect.right
      const origin = { x: event.clientX, y: event.clientY }
      const top = { x: edge, y: rect.top - 6 }
      const bottom = { x: edge, y: rect.bottom + 6 }
      const document = content.ownerDocument
      const move = (next: PointerEvent) => {
        const target = next.target as Node
        if (content.contains(target) || options.anchor()?.contains(target)) {
          stop()
        } else if (!insideTriangle({ x: next.clientX, y: next.clientY }, origin, top, bottom)) {
          close()
        }
      }
      transit = true
      document.addEventListener('pointermove', move, true)
      release = () => document.removeEventListener('pointermove', move, true)
      timer = setTimeout(close, 400)
    },
    leaveContent: () => {
      stop()
      timer = setTimeout(close, 160)
    },
  }
}

/** Checks inclusive triangle containment using consistent signed edge orientations. */
function insideTriangle(point: Point, a: Point, b: Point, c: Point): boolean {
  const side = (p: Point, q: Point, r: Point) =>
    (p.x - r.x) * (q.y - r.y) - (q.x - r.x) * (p.y - r.y)
  const edges = [side(point, a, b), side(point, b, c), side(point, c, a)]

  return !(edges.some((edge) => edge < 0) && edges.some((edge) => edge > 0))
}
