/** @fileoverview Complete chart composition using the official Unovis Solid lifecycle. */

export {
  Chart,
  ChartLegend,
  chartTooltipContent,
  type ChartProps,
  type ChartLegendProps,
  type ChartLegendItem,
} from './presentation'

export {
  XYContainer,
  SingleContainer,
  type XYContainerProps,
  type SingleContainerProps,
  type ChartGeometry,
} from './containers'

export {
  VisLine as Line,
  VisArea as Area,
  VisGroupedBar as GroupedBar,
  VisStackedBar as StackedBar,
  VisScatter as Scatter,
  VisDonut as Donut,
  VisAxis as Axis,
  VisTooltip as ChartTooltip,
  VisCrosshair as Crosshair,
} from '@unovis/solid'
export type {
  VisLineProps as LineProps,
  VisAreaProps as AreaProps,
  VisGroupedBarProps as GroupedBarProps,
  VisStackedBarProps as StackedBarProps,
  VisScatterProps as ScatterProps,
  VisDonutProps as DonutProps,
  VisAxisProps as AxisProps,
  VisTooltipProps as ChartTooltipProps,
  VisCrosshairProps as CrosshairProps,
} from '@unovis/solid'
