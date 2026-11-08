/** @fileoverview Hints share an initial hover wait within their document. Each owns its reading targets. */

import { createSignal } from 'solid-js'
import type { Accessor } from 'solid-js'

interface TooltipGroup {
  owner?: (() => void) | undefined
  warmUntil: number
}

const groups = new WeakMap<Document, TooltipGroup>()

/** Escape suppresses the current interaction until both pointer and focus have left. */
export function createTooltip(delay?: Accessor<number | undefined>) {
  const [open, setOpen] = createSignal(false)
  const [handoff, setHandoff] = createSignal(false)
  const hovered = { trigger: false, content: false }
  let focused = false
  let dismissed = false

  let timer: ReturnType<typeof setTimeout> | undefined
  let group: TooltipGroup | undefined

  const reading = () => hovered.trigger || hovered.content || focused
  const hide = (keepWarm: boolean) => {
    clearTimeout(timer)
    if (group?.owner === yieldToNext) {
      group.warmUntil = keepWarm ? performance.now() + 300 : 0
      if (!keepWarm) {
        group.owner = undefined
      }
    }
    setHandoff(false)
    setOpen(false)
  }
  const yieldToNext = () => {
    clearTimeout(timer)
    setHandoff(true)
    setOpen(false)
  }

  const update = (entering: boolean) => {
    clearTimeout(timer)
    const session = group
    if (!session) {
      return
    }
    if (!reading()) {
      dismissed = false
      if (open()) {
        timer = setTimeout(() => hide(true), 120)
      }
      return
    }
    if (!entering || dismissed || open()) {
      return
    }

    // Claim even the initial wait, so keyboard focus can supersede a pending pointer hint.
    const continuing = performance.now() < session.warmUntil
    if (session.owner !== yieldToNext) {
      session.owner?.()
      session.owner = yieldToNext
    }
    const show = () => {
      session.warmUntil = Infinity
      setHandoff(continuing)
      setOpen(true)
    }
    if (focused || hovered.content || continuing) {
      show()
    } else {
      timer = setTimeout(show, delay?.() ?? 300)
    }
  }

  return {
    open,
    handoff,
    connect: (owner: Document) => {
      group = groups.get(owner)
      if (!group) {
        group = { warmUntil: 0 }
        groups.set(owner, group)
      }
      update(true)
      return () => {
        hide(false)
        group = undefined
        hovered.content = false
      }
    },
    hover: (part: keyof typeof hovered, inside: boolean) => {
      hovered[part] = inside
      update(inside)
    },
    focus: (inside: boolean) => {
      focused = inside
      update(inside)
    },
    dismiss: () => {
      dismissed = reading()
      hide(false)
    },
  }
}
