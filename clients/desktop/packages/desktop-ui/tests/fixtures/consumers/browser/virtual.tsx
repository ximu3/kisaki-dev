/** @fileoverview A large independently virtualized collection exercises stable selection identity. */

import { createSignal, For, onCleanup } from 'solid-js'
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
                    ref={(node) => virtualizer.measureElement(node)}
                    data-index={row.index}
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
