/** @fileoverview Removable selected values with a single horizontal scrolling viewport. */

import { createSignal, For, onCleanup, onMount } from 'solid-js'
import type { JSX } from 'solid-js'
import { Icon, ChevronLeft, ChevronRight, X } from '../icon/glyph'
import styles from './chips.module.css'

/** Accessible labels for removing a selected value and scrolling the selected-value viewport. */
export interface ChipLabels {
  /** Formats the removal action's accessible label from the selected value's display text. */
  removeLabel: (label: string) => string
  scrollPreviousLabel: string
  scrollNextLabel: string
}

/** Ordered selected keys with display labels, availability and field-focus coordination. */
interface SelectedChipsProps extends ChipLabels {
  values: readonly string[]
  /** Resolves a selected key to its current display label. */
  label: (value: string) => string
  disabled: boolean | undefined
  panelId: string
  open: boolean
  /** Returns the complete field element that receives wheel input over the chip area. */
  field: () => HTMLElement
  /** Requests removal of the identified selected value. */
  onRemove: (value: string) => void
  /** Restores field focus after removal or when a scroll control becomes hidden. */
  focusTrigger: () => void
}

/**
 * Renders removable selected values at their natural widths with overflow navigation when needed.
 *
 * Resize observation and wheel handling are released with the component owner.
 */
export function SelectedChips(props: SelectedChipsProps): JSX.Element {
  /** Observed availability of scrolling toward earlier selected chips. */
  const [canPrevious, setCanPrevious] = createSignal(false)
  /** Observed availability of scrolling toward later selected chips. */
  const [canNext, setCanNext] = createSignal(false)
  let group!: HTMLDivElement
  let viewport!: HTMLDivElement
  let track!: HTMLDivElement
  let previous!: HTMLButtonElement
  let next!: HTMLButtonElement

  /** Returns the physical scroll sign for the viewport's current text direction. */
  const direction = () => (getComputedStyle(viewport).direction === 'rtl' ? -1 : 1)
  /**
   * Updates available scroll directions and restores field focus before hiding a focused edge
   * control.
   */
  const update = () => {
    const max = viewport.scrollWidth - viewport.clientWidth
    const offset = direction() * viewport.scrollLeft
    const before = offset > 0.5
    const after = offset < max - 0.5
    const focused = group.ownerDocument.activeElement

    if ((!before && focused === previous) || (!after && focused === next)) {
      props.focusTrigger()
    }
    setCanPrevious(before)
    setCanNext(after)
  }
  /** Moves by a visible page while accounting for both edge-button overlays. */
  const scroll = (step: 1 | -1, arrow: HTMLButtonElement) => {
    // Both edge buttons can be visible between pages. Keep the exposed intervals contiguous.
    const pageWidth =
      viewport.getBoundingClientRect().width - 2 * arrow.getBoundingClientRect().width
    viewport.scrollBy({ left: direction() * step * pageWidth })
  }
  /** Scrolls a focused chip action into the unobscured portion of the viewport. */
  const reveal = (button: Element) => {
    const box = viewport.getBoundingClientRect()
    const target = button.getBoundingClientRect()
    const rtl = direction() < 0
    const left = box.left + (rtl ? next : previous).getBoundingClientRect().width
    const right = box.right - (rtl ? previous : next).getBoundingClientRect().width
    if (target.left < left) {
      viewport.scrollLeft += target.left - left
    } else if (target.right > right) {
      viewport.scrollLeft += target.right - right
    }
  }
  /**
   * Converts eligible wheel input over the chip area into horizontal scrolling while preserving
   * zoom modifiers.
   */
  const wheel = (event: WheelEvent) => {
    if (
      event.ctrlKey ||
      event.metaKey ||
      previous.matches(':disabled') ||
      viewport.scrollWidth <= viewport.clientWidth
    ) {
      return
    }
    if (!(event.target instanceof Node && group.contains(event.target))) {
      const box = group.getBoundingClientRect()
      if (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      ) {
        return
      }
    }

    let unit = 1
    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      unit = viewport.clientWidth
    } else if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      unit = viewport.getBoundingClientRect().height
    }

    const delta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : direction() * event.deltaY
    event.preventDefault()
    viewport.scrollLeft += delta * unit
  }

  onMount(() => {
    const observer = new ResizeObserver(update)
    observer.observe(viewport)
    observer.observe(track)
    const field = props.field()
    field.addEventListener('wheel', wheel, { passive: false })
    onCleanup(() => {
      observer.disconnect()
      field.removeEventListener('wheel', wheel)
    })
  })

  return (
    <div
      class={styles.chips}
      ref={(node) => {
        group = node
      }}
      data-previous={canPrevious() || undefined}
      data-next={canNext() || undefined}
    >
      <button
        type="button"
        class={styles.scroll}
        aria-label={props.scrollPreviousLabel}
        ref={(node) => {
          previous = node
        }}
        hidden={!canPrevious()}
        disabled={props.disabled}
        popovertarget={props.open ? props.panelId : undefined}
        popovertargetaction="show"
        onClick={(event) => {
          event.preventDefault()
          scroll(-1, event.currentTarget)
        }}
      >
        <Icon icon={ChevronLeft} />
      </button>
      <div
        class={styles.viewport}
        ref={(node) => {
          viewport = node
        }}
        onScroll={update}
        onFocusIn={(event) => reveal(event.target)}
      >
        <div
          class={styles.track}
          ref={(node) => {
            track = node
          }}
        >
          <For each={props.values}>
            {(value, index) => (
              <span class={styles.chip}>
                <span>{props.label(value)}</span>
                <button
                  type="button"
                  aria-label={props.removeLabel(props.label(value))}
                  disabled={props.disabled}
                  popovertarget={props.open ? props.panelId : undefined}
                  popovertargetaction="show"
                  onClick={(event) => {
                    event.preventDefault()
                    const position = index()
                    props.onRemove(value)
                    if (props.open) {
                      props.focusTrigger()
                      return
                    }
                    const buttons = track.querySelectorAll('button')
                    const next = buttons[Math.min(position, buttons.length - 1)]
                    if (next) {
                      next.focus()
                    } else {
                      props.focusTrigger()
                    }
                  }}
                >
                  <Icon icon={X} />
                </button>
              </span>
            )}
          </For>
        </div>
      </div>
      <button
        type="button"
        class={styles.scroll}
        aria-label={props.scrollNextLabel}
        ref={(node) => {
          next = node
        }}
        hidden={!canNext()}
        disabled={props.disabled}
        popovertarget={props.open ? props.panelId : undefined}
        popovertargetaction="show"
        onClick={(event) => {
          event.preventDefault()
          scroll(1, event.currentTarget)
        }}
      >
        <Icon icon={ChevronRight} />
      </button>
    </div>
  )
}
