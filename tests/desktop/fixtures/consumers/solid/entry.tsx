/**
 * @fileoverview Exercises public controls, content tools and compiled styles in an independent Solid consumer.
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
import { Chart, VisXYContainer, VisLine, CurveType } from '@kisaki3/ui/chart'
import {
  MarkdownEditor,
  MarkdownPreview,
  MarkdownToolbar,
  markdownCommands,
  type EditorView,
} from '@kisaki3/ui/markdown'
import { createDraggable, DragHandle } from '@kisaki3/ui/drag'

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
      <ContentTools />
    </>
  )
}

/** Exercise specialized exports without importing their private implementation or compiling Tailwind. */
function ContentTools() {
  const [value, setValue] = createSignal('A note')
  const [editor, setEditor] = createSignal<EditorView>()
  const [moves, setMoves] = createSignal(0)
  let row!: HTMLDivElement
  let handle!: HTMLButtonElement
  createDraggable(() => ({
    element: row,
    dragHandle: handle,
    getInitialData: () => ({ key: 'fixture' }),
  }))

  return (
    <section aria-label="Content tools" style={{ width: '360px' }}>
      <Chart aria-label="Synthetic counts" data-consumer-chart>
        <VisXYContainer
          data={[
            { x: 0, y: 1 },
            { x: 1, y: 3 },
            { x: 2, y: 2 },
          ]}
          height={140}
          duration={0}
        >
          <VisLine<{ x: number; y: number }>
            x={(point) => point.x}
            y={(point) => point.y}
            curveType={CurveType.Linear}
          />
        </VisXYContainer>
      </Chart>
      <MarkdownToolbar
        view={editor()}
        aria-label="Formatting"
        items={[{ label: 'Bold', content: <strong>B</strong>, command: markdownCommands.bold }]}
      />
      <MarkdownEditor
        aria-label="Markdown note"
        value={value()}
        onChange={setValue}
        onView={setEditor}
      />
      <MarkdownPreview data-consumer-markdown value={value()} />
      <div
        ref={(element) => {
          row = element
        }}
      >
        <DragHandle
          ref={(element) => {
            handle = element
          }}
          aria-label="Move item"
          onClick={() => setMoves((count) => count + 1)}
        />
        Moves {moves()}
      </div>
    </section>
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
