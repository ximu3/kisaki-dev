/** @fileoverview Delayed submenu intent and a pointer corridor across the gap to its content. */

import { onCleanup } from 'solid-js'

interface Point {
  x: number
  y: number
}

/** Keep only the current transit listener and timer; keyboard opening is owned by the menu. */
export function createSubmenuHover(options: {
  anchor: () => HTMLElement | undefined
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

function insideTriangle(point: Point, a: Point, b: Point, c: Point): boolean {
  const side = (p: Point, q: Point, r: Point) =>
    (p.x - r.x) * (q.y - r.y) - (q.x - r.x) * (p.y - r.y)
  const edges = [side(point, a, b), side(point, b, c), side(point, c, a)]

  return !(edges.some((edge) => edge < 0) && edges.some((edge) => edge > 0))
}
