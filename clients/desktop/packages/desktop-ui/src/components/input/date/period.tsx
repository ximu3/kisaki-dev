/** @fileoverview Calendar month and year choices navigate the view independently of its selected day. */

import { createMemo, createSignal, For } from 'solid-js'
import type { JSX } from 'solid-js'
import { createVirtualizer } from '@tanstack/solid-virtual'
import { createSelectionPopup } from '../../../internal/selection/popup'
import { createSelection } from '../../../internal/selection/collection'
import { SelectionList } from '../../../internal/selection/list'
import { SelectionTrigger } from '../../../internal/selection/trigger'
import type { SelectionOption } from '../../../internal/selection/types'
import styles from './styles.module.css'

/**
 * Inclusive numeric period range, current value and host-owned formatting and navigation callbacks.
 */
interface PeriodProps {
  label: string
  value: number
  first: number
  last: number
  /** Formats a month or year value for its option label. */
  format: (value: number) => string
  /** Requests navigation to the selected month or year. */
  choose: (value: number) => void
}

/** Renders a virtualized period selector, including ranges spanning all 9,999 supported years. */
export function PeriodSelect(props: PeriodProps): JSX.Element {
  const popup = createSelectionPopup()
  /** Presence and visibility controls inherited from this period selector's popup owner. */
  const { present, setOpen } = popup
  /** Reactive viewport reference used by the period list virtualizer. */
  const [viewport, setViewport] = createSignal<HTMLDivElement>()
  let trigger!: HTMLButtonElement

  /** Visible formatted period choices derived from the current bounds. */
  const options = createMemo(() =>
    present()
      ? Array.from({ length: props.last - props.first + 1 }, (_, index) => {
          const value = props.first + index
          return { value: String(value), label: props.format(value) }
        })
      : [],
  )
  /** Current trigger height used to size virtualized period rows while present. */
  const rowHeight = createMemo(() => (present() ? parseFloat(getComputedStyle(trigger).height) : 0))
  const collection = createSelection(options)
  const rows = createVirtualizer({
    /** Reads the live period-option count for virtual geometry. */
    get count() {
      return options().length
    },
    /** Enables measurement while the period popup remains present. */
    get enabled() {
      return present()
    },

    /** Reads the current period-list viewport when it is mounted. */
    getScrollElement: () => viewport() ?? null,
    estimateSize: rowHeight,

    /** Measures actual row border-box height from resize data or computed CSS pixels. */
    measureElement: (element, entry) =>
      entry?.borderBoxSize[0]?.blockSize ?? parseFloat(getComputedStyle(element).height),

    /** Keeps each period row keyed by its actual year or month value. */
    getItemKey: (index) => props.first + index,
    overscan: 3,
  })
  /** Closes the period popup and forwards the selected numeric month or year. */
  const choose = (option: SelectionOption) => {
    setOpen(false)
    props.choose(Number(option.value))
  }

  return (
    <>
      <SelectionTrigger
        ref={(node) => {
          trigger = node
        }}
        aria-label={props.label}
        popup={popup}
        collection={collection}
        selected={[String(props.value)]}
        onBlur={() => setOpen(false)}
        onChoose={choose}
      >
        {props.format(props.value)}
      </SelectionTrigger>
      <SelectionList
        popup={popup}
        label={props.label}
        listClass={styles.periodList}
        anchor={() => trigger}
        listRef={setViewport}
        collection={collection}
        selected={[String(props.value)]}
        onChoose={choose}
        scrollToValue={(value) =>
          rows.scrollToIndex(Number(value) - props.first, { align: 'auto' })
        }
        renderOptions={({ renderOption }) => (
          <div class={styles.periodTrack} style={{ height: `${rows.getTotalSize()}px` }}>
            <For each={rows.getVirtualItems()}>
              {(row) => (
                <div
                  class={styles.periodRow}
                  style={{ transform: `translateY(${row.start}px)` }}
                  ref={(node) => {
                    node.dataset.index = String(row.index)
                    rows.measureElement(node)
                  }}
                >
                  {renderOption(options()[row.index]!)}
                </div>
              )}
            </For>
          </div>
        )}
      />
    </>
  )
}
