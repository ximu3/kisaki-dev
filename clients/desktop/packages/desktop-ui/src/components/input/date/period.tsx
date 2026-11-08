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

interface PeriodProps {
  label: string
  value: number
  first: number
  last: number
  format: (value: number) => string
  choose: (value: number) => void
}

/** Only the visible range mounts, including when the calendar offers all 9,999 years. */
export function PeriodSelect(props: PeriodProps): JSX.Element {
  const popup = createSelectionPopup()
  const { present, setOpen } = popup
  const [viewport, setViewport] = createSignal<HTMLDivElement>()
  let trigger!: HTMLButtonElement

  const options = createMemo(() =>
    present()
      ? Array.from({ length: props.last - props.first + 1 }, (_, index) => {
          const value = props.first + index
          return { value: String(value), label: props.format(value) }
        })
      : [],
  )
  const rowHeight = createMemo(() => (present() ? parseFloat(getComputedStyle(trigger).height) : 0))
  const collection = createSelection(options)
  const rows = createVirtualizer({
    get count() {
      return options().length
    },
    get enabled() {
      return present()
    },
    getScrollElement: () => viewport() ?? null,
    estimateSize: rowHeight,
    measureElement: (element, entry) =>
      entry?.borderBoxSize[0]?.blockSize ?? parseFloat(getComputedStyle(element).height),
    getItemKey: (index) => props.first + index,
    overscan: 3,
  })
  const choose = (option: SelectionOption) => {
    props.choose(Number(option.value))
    setOpen(false)
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
