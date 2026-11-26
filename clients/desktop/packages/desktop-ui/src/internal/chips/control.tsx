import { createSignal, For, onSettled } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { mdiChevronLeft, mdiChevronRight, mdiClose } from '@mdi/js'
import { Icon } from '../../components/icon'
import styles from './styles.module.css'

export interface ChipLabels {
  removeLabel: (label: string) => string
  scrollPreviousLabel: string
  scrollNextLabel: string
}

interface SelectedChipsProps extends ChipLabels {
  values: readonly string[]
  label: (value: string) => string
  disabled: boolean | undefined
  panelId?: string | undefined
  field: () => HTMLElement
  onRemove: (value: string) => void
  focusTrigger: () => void
}

export function SelectedChips(props: SelectedChipsProps): JSX.Element {
  const [canPrevious, setCanPrevious] = createSignal(false)
  const [canNext, setCanNext] = createSignal(false)
  let group!: HTMLDivElement
  let viewport!: HTMLDivElement
  let track!: HTMLDivElement
  let previous!: HTMLButtonElement
  let next!: HTMLButtonElement

  const direction = () => (getComputedStyle(viewport).direction === 'rtl' ? -1 : 1)

  const update = () => {
    const max = viewport.scrollWidth - viewport.clientWidth
    const offset = direction() * viewport.scrollLeft
    const before = offset > 0.5
    const after = offset < max - 0.5
    const focused = group.ownerDocument.activeElement

    if ((!before && focused === previous) || (!after && focused === next)) {
      // Restore focus before hiding a focused scroll control.
      props.focusTrigger()
    }
    setCanPrevious(before)
    setCanNext(after)
  }

  const scroll = (step: 1 | -1, arrow: HTMLButtonElement) => {
    // Both edge buttons can be visible between pages. Keep the exposed intervals contiguous.
    const pageWidth =
      viewport.getBoundingClientRect().width - 2 * arrow.getBoundingClientRect().width
    viewport.scrollBy({ left: direction() * step * pageWidth })
  }

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

  const wheel = (event: WheelEvent) => {
    // Leave the platform zoom gesture to the browser.
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

  onSettled(() => {
    const observer = new ResizeObserver(update)
    observer.observe(viewport)
    observer.observe(track)
    const field = props.field()
    field.addEventListener('wheel', wheel, { passive: false })
    return () => {
      observer.disconnect()
      field.removeEventListener('wheel', wheel)
    }
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
        popovertarget={props.panelId}
        popovertargetaction="show"
        onClick={(event) => {
          event.preventDefault()
          scroll(-1, event.currentTarget)
        }}
      >
        <Icon path={mdiChevronLeft} />
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
                  popovertarget={props.panelId}
                  popovertargetaction="show"
                  onClick={(event) => {
                    event.preventDefault()
                    const position = index()
                    props.onRemove(value)
                    onSettled(() => {
                      if (props.panelId) {
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
                    })
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
        ref={(node) => {
          next = node
        }}
        hidden={!canNext()}
        disabled={props.disabled}
        popovertarget={props.panelId}
        popovertargetaction="show"
        onClick={(event) => {
          event.preventDefault()
          scroll(1, event.currentTarget)
        }}
      >
        <Icon path={mdiChevronRight} />
      </button>
    </div>
  )
}
