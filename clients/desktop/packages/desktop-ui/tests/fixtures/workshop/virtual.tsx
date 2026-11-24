import { createSignal, For, onCleanup } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { createVirtualizer, VirtualRow } from '@kisaki3/desktop-ui/virtualization'
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
          const [retained, setRetained] = createSignal<readonly number[]>([])
          const virtualizer = createVirtualizer({
            get count() {
              return state.options().length
            },

            get viewport() {
              return viewport()
            },

            estimateSize: () => 30,
            overscan: 4,
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
