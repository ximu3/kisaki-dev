/** @fileoverview Removable selected values with a single horizontal scrolling viewport. */

import { createSignal, For, onCleanup, onMount } from 'solid-js'
import type { JSX } from 'solid-js'
import { Icon, mdiChevronLeft, mdiChevronRight, mdiClose } from '../../internal/icon/icon'
import styles from './styles.module.css'

/** Labels describe removing a particular value or revealing selected values in either direction. */
export interface ChipLabels {
  removeLabel: (label: string) => string
  scrollPreviousLabel: string
  scrollNextLabel: string
}

interface SelectedChipsProps extends ChipLabels {
  values: readonly string[]
  label: (value: string) => string
  disabled: boolean | undefined
  onRemove: (value: string) => void
  focusTrigger: () => void
}

/** Preserve the natural width of the content and show navigation only when it exceeds the available space. */
export function SelectedChips(props: SelectedChipsProps): JSX.Element {
  const [overflow, setOverflow] = createSignal(false)
  const [canPrevious, setCanPrevious] = createSignal(false)
  const [canNext, setCanNext] = createSignal(false)
  let group!: HTMLDivElement
  let viewport!: HTMLDivElement
  let track!: HTMLDivElement

  const direction = () => (getComputedStyle(viewport).direction === 'rtl' ? -1 : 1)
  const update = () => {
    setOverflow(track.offsetWidth > group.clientWidth)
    const offset = direction() * viewport.scrollLeft
    setCanPrevious(offset > 0.5)
    setCanNext(offset < viewport.scrollWidth - viewport.clientWidth - 0.5)
  }
  const scroll = (step: number) =>
    viewport.scrollBy({ left: direction() * step * viewport.clientWidth })
  const wheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.shiftKey || event.deltaX || !overflow()) {
      return
    }
    let unit = 1
    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      unit = viewport.clientWidth
    } else if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      unit = parseFloat(getComputedStyle(viewport).lineHeight)
    }

    const before = viewport.scrollLeft
    viewport.scrollLeft += direction() * event.deltaY * unit
    if (viewport.scrollLeft !== before) {
      event.preventDefault()
    }
  }

  onMount(() => {
    const observer = new ResizeObserver(update)
    for (const node of [group, viewport, track]) {
      observer.observe(node)
    }
    viewport.addEventListener('wheel', wheel, { passive: false })
    onCleanup(() => {
      observer.disconnect()
      viewport.removeEventListener('wheel', wheel)
    })
  })

  return (
    <div
      class={styles.chips}
      ref={(node) => {
        group = node
      }}
      data-overflow={overflow() || undefined}
    >
      <button
        type="button"
        class={styles.scroll}
        aria-label={props.scrollPreviousLabel}
        disabled={props.disabled || !canPrevious()}
        onClick={() => scroll(-1)}
      >
        <Icon path={mdiChevronLeft} />
      </button>
      <div
        class={styles.viewport}
        ref={(node) => {
          viewport = node
        }}
        onScroll={update}
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
                  onClick={() => {
                    const position = index()
                    props.onRemove(value)
                    const buttons = track.querySelectorAll('button')
                    const next = buttons[Math.min(position, buttons.length - 1)]
                    if (next) {
                      next.focus()
                    } else {
                      props.focusTrigger()
                    }
                  }}
                >
                  <Icon path={mdiClose} />
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
        disabled={props.disabled || !canNext()}
        onClick={() => scroll(1)}
      >
        <Icon path={mdiChevronRight} />
      </button>
    </div>
  )
}
