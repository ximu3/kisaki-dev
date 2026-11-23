import { createSignal } from 'solid-js'
import { restoringModalFocus } from '../modal-host'
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
  const [open, setOpen] = createSignal(false)
  // An opening handed off from a warm tooltip has no pointer delay.
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
      timer = setTimeout(show, delay?.() ?? 400)
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
    // Native focus restoration should return to the action without reopening its hint.
    focus: (event: FocusEvent & { currentTarget: HTMLElement }) => {
      const target = event.currentTarget
      const previous = event.relatedTarget
      const popup = previous instanceof Element ? previous.closest('[popover]') : null
      focused =
        (event.type === 'focus' || event.type === 'focusin') &&
        !restoringModalFocus(target.ownerDocument) &&
        !(popup && !popup.contains(target))
      update(focused)
    },
    dismiss: () => {
      dismissed = reading()
      hide(false)
    },
  }
}
