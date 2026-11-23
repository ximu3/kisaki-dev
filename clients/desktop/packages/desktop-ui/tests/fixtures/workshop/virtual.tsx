/** @fileoverview A large independently virtualized collection exercises stable selection identity. */

import { createSignal, For, onCleanup } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { createVirtualizer, VirtualRow } from '@kisaki3/desktop-ui/virtualization'
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
          const [retained, setRetained] = createSignal<readonly number[]>([])
          const virtualizer = createVirtualizer({
            /** Reads the live fixture option count for the real virtualizer. */
            get count() {
              return state.options().length
            },

            /** Reads the mounted viewport used by the consumer's real virtualizer. */
            get viewport() {
              return viewport()
            },

            /** Supplies the fixed synthetic row-height estimate before actual measurement. */
            estimateSize: () => 30,
            overscan: 4,
            /** Runs fixture virtual measurements only while the selection surface is present. */
            get enabled() {
              return state.present()
            },
            get retained() {
              return retained()
            },
          })
          scrollTo = (value) => {
            const index = Number(value)
            setRetained([index])
            virtualizer.scrollToIndex(index)
          }
          onCleanup(() => {
            scrollTo = undefined
          })

          return (
            <div style={{ height: `${virtualizer.totalSize()}px`, position: 'relative' }}>
              <For each={virtualizer.items()} keyed={(row) => row.key}>
                {(row) => (
                  <VirtualRow virtualizer={virtualizer} item={row()}>
                    {state.renderOption(state.options()[row().index]!)}
                  </VirtualRow>
                )}
              </For>
            </div>
          )
        }}
      />
    </form>
  )
}
