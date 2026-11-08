/** @fileoverview Lazily loaded chart, Markdown and drag capabilities from the packed public subpaths. */

import { createSignal, onCleanup } from 'solid-js'
import type { JSX } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { MarkdownEditor, MarkdownPreview } from '@kisaki3/desktop-ui/markdown'
import type { MarkdownCommand, MarkdownToolbarAction } from '@kisaki3/desktop-ui/markdown'
import {
  Chart,
  XYContainer,
  Line,
  Area,
  GroupedBar,
  StackedBar,
  Scatter,
  Axis,
  SingleContainer,
  Donut,
  ChartTooltip,
  Crosshair,
  ChartLegend,
  chartTooltipContent,
} from '@kisaki3/desktop-ui/chart'
import {
  createDraggable,
  createDropTarget,
  DragHandle,
  DropIndicator,
  DragFeedback,
  attachClosestEdge,
  extractClosestEdge,
} from '@kisaki3/desktop-ui/drag'
import type { Edge } from '@kisaki3/desktop-ui/drag'
import type {} from './api.js'

type Datum = { x: number; y: number; z: number }

const labels: Record<MarkdownCommand, string> = {
  bold: 'Bold',
  italic: 'Italic',
  strike: 'Strike',
  code: 'Code',
  heading: 'Heading',
  bullet: 'Bullet list',
  ordered: 'Numbered list',
  quote: 'Quote',
  task: 'Task',
  link: 'Link',
  undo: 'Undo',
  redo: 'Redo',
}

const initial =
  '# Sample\n\nSelect text and use the toolbar.\n\n- [x] Completed task\n- [ ] Pending task\n\nA footnote[^a].\n\n[^a]: Local reference.\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n<img src=x onerror=alert(1)>\n\n![Unresolved](https://example.invalid/untrusted.png)\n\n[External](https://example.com/)'

/** Mutable data belongs to the consumer; each capability releases only the resources it creates. */
export default function Resources(): JSX.Element {
  const [text, setText] = createSignal(initial)
  const [readOnly, setReadOnly] = createSignal(false)
  const [sourceOnly, setSourceOnly] = createSignal(false)
  const insertReference: MarkdownToolbarAction = {
    id: 'reference',
    label: 'Insert reference',
    icon: () => <span aria-hidden="true">§</span>,
    run: (editor) => editor.dispatch(editor.state.replaceSelection('Reference')),
  }

  const [data, setData] = createSignal([
    { x: 1, y: 2, z: 1 },
    { x: 2, y: 4, z: 3 },
    { x: 3, y: 3, z: 2 },
  ])
  const [selected, setSelected] = createSignal(true)

  const [edge, setEdge] = createSignal<Edge | null>(null)
  const [feedback, setFeedback] = createSignal('')
  let source!: HTMLDivElement
  let handle!: HTMLButtonElement
  let target!: HTMLDivElement

  createDraggable(() => ({
    element: source,
    dragHandle: handle,
    getInitialData: () => ({ id: 'sample' }),
  }))
  createDropTarget(() => ({
    element: target,
    getData: ({ input, element }) =>
      attachClosestEdge({ id: 'target' }, { input, element, allowedEdges: ['top', 'bottom'] }),
    onDrag: ({ self }) => setEdge(extractClosestEdge(self.data)),
    onDragLeave: () => setEdge(null),
    onDrop: () => {
      setEdge(null)
      setFeedback('Sample moved')
      document.body.dataset.dropped = 'true'
    },
  }))

  window.fixture.editorSet = setText
  window.fixture.setSourceOnly = setSourceOnly

  onCleanup(() => {
    document.body.dataset.resourcesReleased = 'true'
  })

  return (
    <div class="resource-grid">
      <div>
        <label>
          <input
            type="checkbox"
            checked={readOnly()}
            onChange={(event) => setReadOnly(event.currentTarget.checked)}
          />
          Read only
        </label>
        <MarkdownEditor
          style={{ 'max-height': '15rem' }}
          readOnly={readOnly()}
          value={text()}
          onValueChange={setText}
          label="Markdown source"
          toolbarLabel="Formatting"
          commandLabel={(command) => labels[command]}
          toolbar={(standard) => (sourceOnly() ? [] : [...standard, insertReference])}
          onViewChange={(current) => {
            window.fixture.editorText = () => current?.state.doc.toString() ?? ''
            window.fixture.editorSelect = () =>
              current?.dispatch({ selection: { anchor: 2, head: 8 } })
            window.fixture.editorReleased = current === undefined
          }}
        />
        <div class="grid">
          <MarkdownPreview
            id="preview-one"
            value={text()}
            onNavigate={(href) => {
              document.body.dataset.link = href
            }}
          />
          <MarkdownPreview id="preview-two" value={text()} />
        </div>
      </div>
      <div>
        <Button
          variant="outline"
          onClick={() =>
            setData([
              { x: 1, y: 8, z: 2 },
              { x: 2, y: 6, z: 1 },
            ])
          }
        >
          Update chart
        </Button>
        <Chart label="Sample series" summary="Three observations, shown as several chart marks.">
          <XYContainer
            data={data()}
            height={220}
            duration={0}
            onRenderComplete={(geometry) => {
              document.body.dataset.chartWidth = String(geometry.containerWidth)
            }}
          >
            <Area<Datum> x={(item) => item.x} y={(item) => item.z} opacity={0.15} />
            <Line<Datum> x={(item) => item.x} y={(item) => item.y} />
            <Scatter<Datum> x={(item) => item.x} y={(item) => item.y} />
            <GroupedBar<Datum> x={(item) => item.x} y={(item) => item.z} />
            <StackedBar<Datum>
              x={(item) => item.x}
              y={[(item) => item.y, (item) => item.z]}
              barWidth={4}
            />
            <Axis type="x" />
            <Axis type="y" />
            <Crosshair
              hideWhenFarFromPointer={false}
              template={() =>
                chartTooltipContent(document, [
                  { label: 'Safe text', value: '<script>data</script>' },
                ])
              }
            />
            <ChartTooltip />
          </XYContainer>
        </Chart>
        <ChartLegend
          label="Series"
          items={[
            { id: 'series', label: 'Sample series', color: 'var(--chart-1)', selected: selected() },
          ]}
          onToggle={() => setSelected(!selected())}
        />
        <Chart label="Distribution" summary="Values are grouped into three segments.">
          <SingleContainer data={data()} height={160} duration={0}>
            <Donut value={(item: { y: number }) => item.y} />
          </SingleContainer>
        </Chart>
      </div>
      <div
        ref={(node) => {
          source = node
        }}
        class="drag-target"
      >
        <DragHandle
          ref={(node) => {
            handle = node
          }}
          aria-label="Move sample"
          onMove={(direction) => setFeedback(`Moved ${direction}`)}
        >
          ↕
        </DragHandle>
        Sample drag source
      </div>
      <div
        ref={(node) => {
          target = node
        }}
        class="drag-target"
        id="drop-target"
      >
        Drop target{edge() && <DropIndicator edge={edge()!} gap={10} />}
      </div>
      <DragFeedback>{feedback()}</DragFeedback>
    </div>
  )
}
