/** @fileoverview Hints share an initial hover wait within their document. Each owns its reading targets. */

import { createSignal } from 'solid-js'
import type { Accessor } from 'solid-js'

/** Document-wide hint owner and the shared interval for immediate handoff. */
interface TooltipGroup {
  /** Relinquishes the current hint when another interaction takes document ownership. */
  owner?: (() => void) | undefined
  /**
   * Monotonic deadline in milliseconds for immediate handoff; Infinity represents the active warm
   * period.
   */
  warmUntil: number
}

/** Document-scoped hover groups coordinating tooltip delay and handoff timing. */
const groups = new WeakMap<Document, TooltipGroup>()

/**
 * Creates local hint-reading state that coordinates with a document after connection.
 *
 * Dismissal suppresses reopening until pointer and focus leave the current interaction. The
 * connection owner releases timers and shared ownership through its returned cleanup.
 */
export function createTooltip(delay?: Accessor<number | undefined>) {
  /** Requested visibility of this tooltip within its document hover group. */
  const [open, setOpen] = createSignal(false)
  /** Whether this opening follows an already active tooltip in the same hover group. */
  const [handoff, setHandoff] = createSignal(false)
  const hovered = { trigger: false, content: false }
  let focused = false
  let dismissed = false

  let timer: ReturnType<typeof setTimeout> | undefined
  let group: TooltipGroup | undefined

  /**
   * Checks whether trigger hover, content hover or keyboard focus still owns the reading
   * interaction.
   */
  const reading = () => hovered.trigger || hovered.content || focused
  /** Closes this hint and optionally retains its document's immediate-handoff interval. */
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
  /** Cancels the pending wait and marks this hint closed for handoff to another owner. */
  const yieldToNext = () => {
    clearTimeout(timer)
    setHandoff(true)
    setOpen(false)
  }

  /**
   * Schedules opening or closure from current hover, focus, dismissal and document-handoff state.
   */
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
    /** Opens the owned hint and marks the document's immediate-handoff period active. */
    const show = () => {
      session.warmUntil = Infinity
      setHandoff(continuing)
      setOpen(true)
    }
    if (focused || hovered.content || continuing) {
      show()
    } else {
      timer = setTimeout(show, delay?.() ?? 400)
    }
  }

  return {
    open,
    handoff,
    /**
     * Connects to the document's shared hint group and returns cleanup for timers and current
     * ownership.
     */
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
    /**
     * Updates pointer presence on the trigger or explanation and reconciles the reading lifetime.
     */
    hover: (part: keyof typeof hovered, inside: boolean) => {
      hovered[part] = inside
      update(inside)
    },
    /** Updates keyboard-focus presence and reconciles the reading lifetime. */
    focus: (inside: boolean) => {
      focused = inside
      update(inside)
    },
    /** Hides the hint and suppresses reopening until the current reading interaction fully ends. */
    dismiss: () => {
      dismissed = reading()
      hide(false)
    },
  }
}
