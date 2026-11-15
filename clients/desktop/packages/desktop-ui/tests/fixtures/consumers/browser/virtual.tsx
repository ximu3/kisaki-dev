/** @fileoverview A large independently virtualized collection exercises stable selection identity. */

import { createEffect, createSignal, For, onCleanup } from 'solid-js'
import type { JSX } from 'solid-js'
import { createVirtualizer } from '@tanstack/solid-virtual'
import { MultiSelect } from '@kisaki3/desktop-ui/select'

/** Ten-thousand-option synthetic input for virtualized selection and scrolling checks. */
const choices = Array.from({ length: 10_000 }, (_, index) => ({
  value: String(index),
  label: `Item ${index + 1}`,
}))

/** Exercises a large virtualized multi-selection through the packed public field API. */
export function VirtualChoices(): JSX.Element {
  /** Reactive scroll viewport used by the standalone virtual-selection consumer. */
  const [viewport, setViewport] = createSignal<HTMLDivElement>()
  /** Reveals the fixture's numeric option key through its currently mounted virtual row index. */
  let scrollTo: ((value: string) => void) | undefined

  return (
    <form id="virtual-form">
      <MultiSelect
        removeLabel={(label) => `Remove ${label}`}
        scrollPreviousLabel="Previous selected items"
        scrollNextLabel="Next selected items"
        name="virtual"
        aria-label="Virtual choices"
        options={choices}
        defaultValue={['8999']}
        placeholder="Choose items"
        emptyMessage="No choices"
        invalidSelectionMessage="Choose available items."
        listRef={setViewport}
        scrollToValue={(value) => scrollTo?.(value)}
        renderOptions={(state) => {
          const virtualizer = createVirtualizer({
            /** Reads the live fixture option count for the real virtualizer. */
            get count() {
              return state.options().length
            },

            /** Reads the mounted viewport used by the consumer's real virtualizer. */
            getScrollElement: () => viewport() ?? null,

            /** Supplies the fixed synthetic row-height estimate before actual measurement. */
            estimateSize: () => 30,
            overscan: 4,
            /** Runs fixture virtual measurements only while the selection surface is present. */
            get enabled() {
              return state.present()
            },
          })
          createEffect(() => {
            virtualizer.getVirtualItems()
            virtualizer.measureElement(null)
          })
          scrollTo = (value) => virtualizer.scrollToIndex(Number(value), { align: 'auto' })
          onCleanup(() => {
            scrollTo = undefined
          })

          return (
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
              <For each={virtualizer.getVirtualItems()}>
                {(row) => (
                  <div
                    ref={(node) => {
                      node.dataset.index = String(row.index)
                      virtualizer.measureElement(node)
                    }}
                    style={{
                      position: 'absolute',
                      width: '100%',
                      transform: `translateY(${row.start}px)`,
                    }}
                  >
                    {state.renderOption(state.options()[row.index]!)}
                  </div>
                )}
              </For>
            </div>
          )
        }}
      />
    </form>
  )
}
