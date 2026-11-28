import { createMemo, createSignal, For } from 'solid-js'
import {
  Chart,
  XYContainer,
  Area,
  Axis,
  Line,
  GroupedBar,
  Crosshair,
  ChartTooltip,
  chartTooltipContent,
} from '@kisaki3/desktop-ui/chart'
import { Button } from '@kisaki3/desktop-ui/button'
import type { ActivityStatistics, InstantRange } from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../infrastructure/api'
import { fromDay, daySpan, shift, type Period } from './period'

type Bucket = 'day' | 'week' | 'month'
interface Point {
  x: number
  hours: number
  label: string
  range: InstantRange
}
function startDate(date: Date, unit: Bucket) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  if (unit === 'month') {
    d.setDate(1)
  }
  if (unit === 'week') {
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  }
  return d
}
function nextDate(d: Date, unit: Bucket) {
  if (unit === 'week' || unit === 'month') {
    return shift(d, unit, 1)
  }
  return new Date(daySpan(d).to)
}
function points(
  days: ActivityStatistics['groups'],
  range: InstantRange | undefined,
  unit: Bucket,
  locale: string,
) {
  const now = new Date(),
    end = range?.to ?? daySpan(startDate(now, 'day')).to,
    start =
      range?.from ?? new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1).getTime()
  const values = new Map<number, number>()
  for (const row of days) {
    const d = fromDay(row.date)
    if (d.getTime() < start || d.getTime() >= end) {
      continue
    }
    const time = startDate(d, unit).getTime()
    values.set(time, (values.get(time) ?? 0) + row.durationMs)
  }
  const axis = new Intl.DateTimeFormat(
    locale,
    unit === 'month' ? { year: 'numeric', month: 'short' } : { month: 'short', day: 'numeric' },
  )
  const series: Point[] = []
  for (let d = startDate(new Date(start), unit); d.getTime() < end; d = nextDate(d, unit)) {
    series.push({
      x: series.length,
      hours: (values.get(d.getTime()) ?? 0) / 3600000,
      label: axis.format(d),
      range: { from: Math.max(start, d.getTime()), to: Math.min(end, nextDate(d, unit).getTime()) },
    })
  }
  return series
}
function Segment<K extends string>(props: {
  items: readonly K[]
  value: K
  label: (v: K) => string
  change: (v: K) => void
}) {
  return (
    <div class="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
      <For each={props.items}>
        {(v) => (
          <Button
            size="sm"
            class="h-6 px-2 text-xs"
            variant={props.value === v ? 'secondary' : 'ghost'}
            aria-pressed={props.value === v ? 'true' : 'false'}
            onClick={() => props.change(v)}
          >
            {props.label(v)}
          </Button>
        )}
      </For>
    </div>
  )
}
export { Segment }
export function ActivityCharts(props: {
  api: MainClient
  days: ActivityStatistics['groups']
  hours: ActivityStatistics['groups']
  range: InstantRange | undefined
  period: Period
  drill: (range: InstantRange, label: string) => void
}) {
  const { api } = props,
    t = api.t,
    [heat, setHeat] = createSignal<Bucket>('day'),
    [trend, setTrend] = createSignal<Bucket>('month'),
    [distribution, setDistribution] = createSignal<'hour' | 'weekday' | 'monthDay'>('hour')
  const cells = createMemo(() => points(props.days, props.range, heat(), api.locale()))
  const trendData = createMemo(() => points(props.days, props.range, trend(), api.locale()))
  const highest = createMemo(() => cells().reduce((n, p) => Math.max(n, p.hours), 0)),
    shade = (level: number) =>
      level === 0
        ? 'var(--muted)'
        : 'color-mix(in oklch,var(--primary) ' + level + '%,var(--muted))'
  const dist = createMemo(() => {
    const key = distribution(),
      length = { hour: 24, weekday: 7, monthDay: 31 }[key],
      names = new Intl.DateTimeFormat(api.locale(), { weekday: 'short' })
    const counts = Array.from({ length }, (_, x) => ({
      x,
      hours: 0,
      label: {
        hour: x + ':00',
        weekday: names.format(new Date(2025, 0, 5 + x)),
        monthDay: String(x + 1),
      }[key],
    }))
    for (const row of key === 'hour' ? props.hours : props.days) {
      const d = fromDay(row.date),
        index = { hour: row.hour!, weekday: d.getDay(), monthDay: d.getDate() - 1 }[key]
      counts[index]!.hours += row.durationMs / 3600000
    }
    return counts
  })
  const labels = (k: Bucket) => t(`library.statistics.${k}`)
  return (
    <>
      <section class="space-y-2 p-4">
        <div class="flex h-7 items-center justify-between gap-2">
          <h2 class="text-xs font-medium text-muted-foreground">
            {t('library.statistics.heatmap')}
          </h2>
          <Segment
            items={['day', 'week', 'month'] as const}
            value={heat()}
            label={labels}
            change={setHeat}
          />
        </div>
        <div
          class="grid gap-[0.22rem] py-2"
          style={{ 'grid-template-columns': 'repeat(auto-fill,minmax(0.98rem,1fr))' }}
        >
          <For each={cells()}>
            {(cell) => (
              <button
                class="aspect-square rounded-[2px]"
                title={cell.label + ' · ' + cell.hours.toFixed(1) + ' h'}
                aria-label={cell.label}
                style={{
                  background: shade(cell.hours ? 20 + (65 * cell.hours) / (highest() || 1) : 0),
                }}
                onClick={() => props.drill(cell.range, cell.label)}
              />
            )}
          </For>
        </div>
        <div class="flex justify-end items-center gap-1 text-xs text-muted-foreground">
          {t('library.statistics.less')}
          <For each={[0, 20, 40, 60, 85]}>
            {(v) => <i class="size-2.5 rounded-sm" style={{ background: shade(v) }} />}
          </For>
          {t('library.statistics.more')}
        </div>
      </section>
      <div class="grid divide-y divide-border @4xl:grid-cols-[2fr_1fr] @4xl:divide-x @4xl:divide-y-0">
        <section class="min-w-0 space-y-2 p-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xs font-medium text-muted-foreground">
              {t('library.statistics.trend')}
            </h2>
            <Segment
              items={['day', 'week', 'month'] as const}
              value={trend()}
              label={labels}
              change={setTrend}
            />
          </div>
          <Chart label={t('library.statistics.trend')} summary={t('library.statistics.duration')}>
            <XYContainer height={196} data={trendData()} yDomain={[0, undefined]}>
              <Area<Point> x={(p) => p.x} y={(p) => p.hours} opacity={0.14} />
              <Line<Point> x={(p) => p.x} y={(p) => p.hours} />
              <Axis
                type="x"
                numTicks={7}
                tickFormat={(v) => trendData()[Math.round(Number(v))]?.label ?? ''}
              />
              <Axis type="y" numTicks={4} tickFormat={(v) => Number(v).toFixed(1) + 'h'} />
              <Crosshair<Point>
                template={(p) =>
                  chartTooltipContent(document, [
                    { label: p.label, value: p.hours.toFixed(1) + ' h' },
                  ])
                }
              />
              <ChartTooltip />
            </XYContainer>
          </Chart>
        </section>
        <section class="min-w-0 space-y-2 p-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xs font-medium text-muted-foreground">
              {t('library.statistics.distribution')}
            </h2>
            <Segment
              items={['hour', 'weekday', 'monthDay'] as const}
              value={distribution()}
              label={(k) => t(`library.statistics.${k}`)}
              change={setDistribution}
            />
          </div>
          <Chart
            label={t('library.statistics.distribution')}
            summary={t('library.statistics.duration')}
          >
            <XYContainer height={196} data={dist()} yDomain={[0, undefined]}>
              <GroupedBar<{ x: number; hours: number }> x={(p) => p.x} y={(p) => p.hours} />
              <Axis
                type="x"
                numTicks={5}
                tickFormat={(v) => dist()[Math.round(Number(v))]?.label ?? ''}
              />
              <Axis type="y" numTicks={4} tickFormat={(v) => Number(v).toFixed(1) + 'h'} />
            </XYContainer>
          </Chart>
        </section>
      </div>
    </>
  )
}
