/** @fileoverview A large independently virtualized collection exercises stable selection identity. */

import { createEffect, createSignal, For, onCleanup } from 'solid-js'
import type { JSX } from 'solid-js'
import { createVirtualizer } from '@tanstack/solid-virtual'
import { MultiSelect } from '@kisaki3/desktop-ui/select'

const choices = Array.from({ length: 10_000 }, (_, index) => ({
  value: String(index),
  label: `Item ${index + 1}`,
}))

export function VirtualChoices(): JSX.Element {
  const [viewport, setViewport] = createSignal<HTMLDivElement>()
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
            get count() {
              return state.options().length
            },
            getScrollElement: () => viewport() ?? null,
            estimateSize: () => 30,
            overscan: 4,
            get enabled() {
              return state.open()
            },
          })
          createEffect(() => {
            virtualizer.getVirtualItems()
            virtualizer.measureElement(null)
          })
          scrollTo = (value) =>
            queueMicrotask(() => {
              if (state.open()) {
                virtualizer.scrollToIndex(Number(value), { align: 'auto' })
              }
            })
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
