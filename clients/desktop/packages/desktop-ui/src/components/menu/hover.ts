/** @fileoverview Delayed submenu intent and a pointer corridor across the gap to its content. */

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
  /** Returns the submenu trigger used to recognize pointer re-entry. */
  anchor: () => HTMLElement | undefined
  /** Returns the submenu surface whose near edge defines the pointer corridor. */
  content: () => HTMLElement | undefined
  /** Reads whether the submenu is currently open. */
  isOpen: () => boolean
  /** Requests opening after hover intent is established. */
  open: () => void
  /** Requests closing after pointer intent leaves the submenu. */
  close: () => void
}) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let release: (() => void) | undefined
  let transit = false
  /** Cancels the current hover timer and transit listener and clears protected transit state. */
  const stop = () => {
    clearTimeout(timer)
    release?.()
    release = undefined
    transit = false
  }
  /** Stops hover tracking and requests closing the submenu. */
  const close = () => {
    stop()
    options.close()
  }
  onCleanup(stop)

  return {
    /** Reports whether pointer transit toward submenu content is currently protected. */
    inTransit: () => transit,
    stop,
    /** Cancels pending closure and schedules opening when the trigger is entered. */
    enter: () => {
      stop()
      if (!options.isOpen()) {
        timer = setTimeout(options.open, 120)
      }
    },
    /**
     * Tracks departure toward open content, closing when the pointer leaves its corridor or the
     * transit budget ends.
     */
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
      /**
       * Ends transit on trigger or content re-entry and closes when the pointer leaves the
       * corridor.
       */
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
      /** Removes the current document's capture-phase pointer-transit listener. */
      release = () => document.removeEventListener('pointermove', move, true)
      timer = setTimeout(close, 400)
    },
    /** Schedules delayed closure after leaving submenu content. */
    leaveContent: () => {
      stop()
      timer = setTimeout(close, 160)
    },
  }
}

/** Checks inclusive triangle containment using consistent signed edge orientations. */
function insideTriangle(point: Point, a: Point, b: Point, c: Point): boolean {
  /** Computes the signed cross product for three viewport points. */
  const side = (p: Point, q: Point, r: Point) =>
    (p.x - r.x) * (q.y - r.y) - (q.x - r.x) * (p.y - r.y)
  const edges = [side(point, a, b), side(point, b, c), side(point, c, a)]

  return !(edges.some((edge) => edge < 0) && edges.some((edge) => edge > 0))
}
