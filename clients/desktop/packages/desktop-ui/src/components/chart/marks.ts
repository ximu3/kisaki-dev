import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import {
  Line as LineEngine,
  Area as AreaEngine,
  GroupedBar as GroupedBarEngine,
  StackedBar as StackedBarEngine,
  Scatter as ScatterEngine,
  Axis as AxisEngine,
  Donut as DonutEngine,
  type LineConfigInterface,
  type AreaConfigInterface,
  type GroupedBarConfigInterface,
  type StackedBarConfigInterface,
  type ScatterConfigInterface,
  type AxisConfigInterface,
  type DonutConfigInterface,
} from '@unovis/ts'
import { chartPart, type ChartDataProps } from './parts'

export type LineProps<Datum> = LineConfigInterface<Datum> & ChartDataProps<Datum>

export function Line<Datum>(props: LineProps<Datum>): JSX.Element {
  return chartPart(
    'series',
    () => new LineEngine<Datum>(),
    () => omit(props, 'data'),
    () => props.data,
  )
}

export type AreaProps<Datum> = AreaConfigInterface<Datum> & ChartDataProps<Datum>

export function Area<Datum>(props: AreaProps<Datum>): JSX.Element {
  return chartPart(
    'series',
    () => new AreaEngine<Datum>(),
    () => omit(props, 'data'),
    () => props.data,
  )
}

export type GroupedBarProps<Datum> = GroupedBarConfigInterface<Datum> & ChartDataProps<Datum>

export function GroupedBar<Datum>(props: GroupedBarProps<Datum>): JSX.Element {
  return chartPart(
    'series',
    () => new GroupedBarEngine<Datum>(),
    () => omit(props, 'data'),
    () => props.data,
  )
}

export type StackedBarProps<Datum> = StackedBarConfigInterface<Datum> & ChartDataProps<Datum>

export function StackedBar<Datum>(props: StackedBarProps<Datum>): JSX.Element {
  return chartPart(
    'series',
    () => new StackedBarEngine<Datum>(),
    () => omit(props, 'data'),
    () => props.data,
  )
}

export type ScatterProps<Datum> = ScatterConfigInterface<Datum> & ChartDataProps<Datum>

export function Scatter<Datum>(props: ScatterProps<Datum>): JSX.Element {
  return chartPart(
    'series',
    () => new ScatterEngine<Datum>(),
    () => omit(props, 'data'),
    () => props.data,
  )
}

export type AxisProps<Datum> = AxisConfigInterface<Datum> & ChartDataProps<Datum>

export function Axis<Datum>(props: AxisProps<Datum>): JSX.Element {
  return chartPart(
    () => (props.type === 'y' ? 'yAxis' : 'xAxis'),
    () => new AxisEngine<Datum>(),
    () => omit(props, 'data'),
    () => props.data,
  )
}

export type DonutProps<Datum> = DonutConfigInterface<Datum> & ChartDataProps<Datum>

export function Donut<Datum>(props: DonutProps<Datum>): JSX.Element {
  return chartPart(
    'single',
    () => new DonutEngine<Datum>(),
    () => omit(props, 'data'),
    () => props.data,
  )
}

export const donutSelectors: Readonly<{ segment: string }> = {
  segment: DonutEngine.selectors.segment,
}
