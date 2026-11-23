/** @fileoverview Typed chart marks and axes composed through the Unovis TypeScript engine. */

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
} from '@unovis/ts'
import type {
  LineConfigInterface,
  AreaConfigInterface,
  GroupedBarConfigInterface,
  StackedBarConfigInterface,
  ScatterConfigInterface,
  AxisConfigInterface,
  DonutConfigInterface,
} from '@unovis/ts'
import { chartPart, type ChartDataProps } from './parts'

/** Public configuration for the Unovis Line component. */
export type LineProps<Datum> = LineConfigInterface<Datum> & ChartDataProps<Datum>

/** Contributes a reactive Line configuration to the owning chart. */
export function Line<Datum>(props: LineProps<Datum>): JSX.Element {
  return chartPart(
    'series',
    () => new LineEngine<Datum>(),
    () => omit(props, 'data'),
    () => props.data,
  )
}

/** Public configuration for the Unovis Area component. */
export type AreaProps<Datum> = AreaConfigInterface<Datum> & ChartDataProps<Datum>

/** Contributes a reactive Area configuration to the owning chart. */
export function Area<Datum>(props: AreaProps<Datum>): JSX.Element {
  return chartPart(
    'series',
    () => new AreaEngine<Datum>(),
    () => omit(props, 'data'),
    () => props.data,
  )
}

/** Public configuration for the Unovis GroupedBar component. */
export type GroupedBarProps<Datum> = GroupedBarConfigInterface<Datum> & ChartDataProps<Datum>

/** Contributes a reactive GroupedBar configuration to the owning chart. */
export function GroupedBar<Datum>(props: GroupedBarProps<Datum>): JSX.Element {
  return chartPart(
    'series',
    () => new GroupedBarEngine<Datum>(),
    () => omit(props, 'data'),
    () => props.data,
  )
}

/** Public configuration for the Unovis StackedBar component. */
export type StackedBarProps<Datum> = StackedBarConfigInterface<Datum> & ChartDataProps<Datum>

/** Contributes a reactive StackedBar configuration to the owning chart. */
export function StackedBar<Datum>(props: StackedBarProps<Datum>): JSX.Element {
  return chartPart(
    'series',
    () => new StackedBarEngine<Datum>(),
    () => omit(props, 'data'),
    () => props.data,
  )
}

/** Public configuration for the Unovis Scatter component. */
export type ScatterProps<Datum> = ScatterConfigInterface<Datum> & ChartDataProps<Datum>

/** Contributes a reactive Scatter configuration to the owning chart. */
export function Scatter<Datum>(props: ScatterProps<Datum>): JSX.Element {
  return chartPart(
    'series',
    () => new ScatterEngine<Datum>(),
    () => omit(props, 'data'),
    () => props.data,
  )
}

/** Public configuration for the Unovis Axis component. */
export type AxisProps<Datum> = AxisConfigInterface<Datum> & ChartDataProps<Datum>

/** Contributes a reactive Axis configuration to the owning chart. */
export function Axis<Datum>(props: AxisProps<Datum>): JSX.Element {
  return chartPart(
    () => (props.type === 'y' ? 'yAxis' : 'xAxis'),
    () => new AxisEngine<Datum>(),
    () => omit(props, 'data'),
    () => props.data,
  )
}

/** Public configuration for the Unovis Donut component. */
export type DonutProps<Datum> = DonutConfigInterface<Datum> & ChartDataProps<Datum>

/** Contributes a reactive Donut configuration to the owning chart. */
export function Donut<Datum>(props: DonutProps<Datum>): JSX.Element {
  return chartPart(
    'single',
    () => new DonutEngine<Datum>(),
    () => omit(props, 'data'),
    () => props.data,
  )
}
