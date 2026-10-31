/**
 * @fileoverview Exercises the public Solid button and compiled styles in an independent
 * counter page.
 */

import { createSignal, For, Show } from 'solid-js'
import { render } from 'solid-js/web'
import {
  Button,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
  TextField,
  TextFieldLabel,
  TextFieldInput,
  TextFieldErrorMessage,
  createVirtualizer,
} from '@kisaki3/ui'
import '@kisaki3/appearance/styles.css'
import '@kisaki3/ui/styles.css'

function Counter() {
  const [count, setCount] = createSignal(0)
  const [visible, setVisible] = createSignal(true)

  return (
    <>
      <Button onClick={() => setCount((value) => value + 1)}>Count {count()}</Button>
      <Dialog>
        <DialogTrigger>Open dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Consumer dialog</DialogTitle>
          <DialogDescription>Accessible focus and form controls.</DialogDescription>
          <TextField validationState="invalid">
            <TextFieldLabel>Library name</TextFieldLabel>
            <TextFieldInput />
            <TextFieldErrorMessage>A name is required.</TextFieldErrorMessage>
          </TextField>
          <DialogClose>Close dialog</DialogClose>
        </DialogContent>
      </Dialog>
      <Button onClick={() => setVisible((value) => !value)}>Toggle virtual view</Button>
      <Show when={visible()}>
        <VirtualRows />
      </Show>
    </>
  )
}

/** Synthetic rows exercise geometry only; real query identity and selection belong to each consuming view. */
function VirtualRows() {
  let viewport: HTMLDivElement | undefined
  const [height, setHeight] = createSignal(24)
  const virtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: 5000,
    getScrollElement: () => viewport ?? null,
    get estimateSize() {
      return () => height()
    },
    getItemKey: (index) => `row-${index}`,
    overscan: 3,
  })

  return (
    <section aria-label="Virtual geometry">
      <Button onClick={() => virtualizer.scrollToIndex(4999, { align: 'end' })}>Last row</Button>
      <Button
        onClick={() => {
          setHeight(48)
          virtualizer.measure()
        }}
      >
        Tall rows
      </Button>
      <div
        ref={(element) => {
          viewport = element
        }}
        data-virtual-viewport
        style={{ height: '240px', width: '320px', overflow: 'auto' }}
      >
        <div
          style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}
        >
          <For each={virtualizer.getVirtualItems()}>
            {(row) => (
              <div
                ref={(element) => virtualizer.measureElement(element)}
                data-index={row.index}
                data-row={row.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${height()}px`,
                  transform: `translateY(${row.start}px)`,
                }}
              >
                Row {row.index}
              </div>
            )}
          </For>
        </div>
      </div>
    </section>
  )
}

const root = document.getElementById('root')
if (!root) {
  throw new Error('Consumer root is missing')
}

render(() => <Counter />, root)
