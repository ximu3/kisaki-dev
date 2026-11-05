/** @fileoverview SVG compositions observe data, series selection and the owning Solid view. */

import { createSignal, Show } from 'solid-js'
import {
  ChartArea,
  ChartAxis,
  ChartCrosshair,
  ChartDonut,
  ChartGroupedBar,
  ChartLegend,
  ChartLine,
  ChartScatter,
  ChartStackedBar,
  ChartTooltip,
  SingleChart,
  XYChart,
} from '@kisaki3/desktop-ui/chart'
import { Button } from '@kisaki3/desktop-ui/button'

type Point = { day: number; pages: number }
const day = (d: Point) => d.day
const pages = (d: Point) => d.pages

export default function Activity() {
  const [data, setData] = createSignal([
    { day: 1, pages: 12 },
    { day: 2, pages: 4 },
    { day: 3, pages: 10 },
  ])
  const [line, setLine] = createSignal(true)

  return (
    <section>
      <h2>Reading activity</h2>
      <ChartLegend
        label="Series"
        items={[{ key: 'pages', label: 'Pages', color: 'var(--chart)', selected: line() }]}
        onToggle={() => setLine(!line())}
      />
      <XYChart
        label="Daily activity"
        summary={data()
          .map((d) => d.pages)
          .join(', ')}
        height={200}
        duration={0}
        data={data()}
      >
        <ChartArea x={day} y={pages} opacity={0.1} />
        <ChartGroupedBar x={day} y={pages} groupWidth={4} />
        <ChartStackedBar x={day} y={pages} barWidth={2} />
        <Show when={line()}>
          <ChartLine x={day} y={pages} />
        </Show>
        <ChartScatter x={day} y={pages} size={5} />
        <ChartAxis type="x" />
        <ChartAxis type="y" />
        <ChartCrosshair<Point>
          hideWhenFarFromPointer={false}
          x={day}
          y={pages}
          format={(d) => '<b>' + (d?.pages ?? 0) + '</b>'}
        />
        <ChartTooltip />
      </XYChart>
      <SingleChart
        label="Distribution"
        summary="Pages by day"
        height={110}
        duration={0}
        data={data()}
      >
        <ChartDonut value={pages} arcWidth={12} />
      </SingleChart>
      <Button
        onClick={() =>
          setData([
            { day: 1, pages: 9 },
            { day: 2, pages: 15 },
          ])
        }
      >
        Update activity
      </Button>
    </section>
  )
}
