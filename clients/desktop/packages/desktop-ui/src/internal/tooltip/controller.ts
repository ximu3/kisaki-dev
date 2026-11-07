/** @fileoverview One reading interaction spans trigger hover, content hover and keyboard focus. */

import { createSignal, onCleanup } from 'solid-js'
import type { Accessor } from 'solid-js'

/** Escape suppresses the current interaction until both pointer and focus have left. */
export function createTooltip(delay: Accessor<number>) {
  const [open, setOpen] = createSignal(false)
  const hovered = { trigger: false, content: false }
  let focused = false
  let dismissed = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const update = (immediate: boolean) => {
    clearTimeout(timer)
    const active = hovered.trigger || hovered.content || focused
    if (!active) {
      dismissed = false
      timer = setTimeout(() => setOpen(false), 120)
    } else if (!dismissed) {
      if (immediate || focused || hovered.content) {
        setOpen(true)
      } else {
        timer = setTimeout(() => setOpen(true), delay())
      }
    }
  }
  onCleanup(() => clearTimeout(timer))

  return {
    open,
    hover: (part: keyof typeof hovered, inside: boolean) => {
      hovered[part] = inside
      update(false)
    },
    focus: (inside: boolean) => {
      focused = inside
      update(inside)
    },
    dismiss: () => {
      clearTimeout(timer)
      dismissed = true
      setOpen(false)
    },
  }
}
