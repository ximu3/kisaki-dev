/** @fileoverview Calendar month and year choices navigate the view independently of its selected day. */

import { createMemo, createSignal, createUniqueId, For } from 'solid-js'
import type { JSX } from 'solid-js'
import { createVirtualizer } from '@tanstack/solid-virtual'
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
  const [open, setOpen] = createSignal(false)
  const [viewport, setViewport] = createSignal<HTMLDivElement>()
  const id = createUniqueId()
  let trigger!: HTMLButtonElement

  const options = createMemo(() =>
    open()
      ? Array.from({ length: props.last - props.first + 1 }, (_, index) => {
          const value = props.first + index
          return { value: String(value), label: props.format(value) }
        })
      : [],
  )
  const rowHeight = createMemo(() => (open() ? trigger.getBoundingClientRect().height : 0))
  const collection = createSelection(options)
  const rows = createVirtualizer({
    get count() {
      return options().length
    },
    get enabled() {
      return open()
    },
    getScrollElement: () => viewport() ?? null,
    estimateSize: rowHeight,
    measureElement: (element) => element.getBoundingClientRect().height,
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
        class={styles.period}
        aria-label={props.label}
        listId={id}
        collection={collection}
        selected={[String(props.value)]}
        open={open()}
        onOpenChange={setOpen}
        onChoose={choose}
      >
        {props.format(props.value)}
      </SelectionTrigger>
      <SelectionList
        id={id}
        label={props.label}
        listClass={styles.periodList}
        anchor={() => trigger}
        listRef={setViewport}
        collection={collection}
        selected={[String(props.value)]}
        open={open()}
        onOpenChange={setOpen}
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
