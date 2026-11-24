import { createEffect, omit, onCleanup } from 'solid-js'
import type { JSX } from '@solidjs/web'
import {
  XYContainer as XY,
  SingleContainer as Single,
  type ComponentCore,
  type XYContainerConfigInterface,
  type SingleContainerConfigInterface,
  type Spacing,
  type Tooltip,
} from '@unovis/ts'
import { createChartDuration } from './motion'
import { chartParts, releaseRemoved, type ChartPart, type ChartPartLifetime } from './parts'

export interface ChartGeometry {
  readonly margin: Readonly<Spacing>
  readonly bleed: Readonly<Spacing>

  readonly containerWidth: number
  readonly containerHeight: number

  readonly componentWidth: number
  readonly componentHeight: number
}

interface PlotProps<Data> {
  children?: JSX.Element
  data?: Data | undefined
  class?: string | undefined
  style?: JSX.CSSProperties | undefined
  onRenderComplete?: (geometry: ChartGeometry) => void
}

const empty: never[] = []

function plotStyle(style: JSX.CSSProperties | undefined): JSX.CSSProperties {
  return { display: 'block', position: 'relative', width: '100%', ...style }
}

function attachTooltip(tooltip: Tooltip | undefined, host: HTMLElement): void {
  if (!tooltip) {
    return
  }
  const target = tooltip.config.container ?? host
  if (tooltip.element.parentElement !== target) {
    tooltip.setContainer(target)
  }
}

export type XYContainerProps<Datum> = Omit<
  XYContainerConfigInterface<Datum>,
  | 'components'
  | 'xAxis'
  | 'yAxis'
  | 'tooltip'
  | 'crosshair'
  | 'annotations'
  | 'onRenderComplete'
  | 'bleed'
> &
  PlotProps<Datum[]> & { bleed?: Readonly<Spacing> }

export function XYContainer<Datum>(props: XYContainerProps<Datum>): JSX.Element {
  let host!: HTMLDivElement
  let plot: XY<Datum> | undefined
  let active: ChartPartLifetime[] = []

  const options = omit(props, 'children', 'data', 'class', 'style', 'duration', 'onRenderComplete')
  const duration = createChartDuration(() => props.duration)
  const children = chartParts<Datum>(() => props.children)
  const onRenderComplete: NonNullable<XYContainerConfigInterface<Datum>['onRenderComplete']> = (
    _svg,
    margin,
    bleed,
    containerWidth,
    containerHeight,
    componentWidth,
    componentHeight,
  ) => {
    props.onRenderComplete?.({
      margin: { ...margin },
      bleed: { ...bleed },
      containerWidth,
      containerHeight,
      componentWidth,
      componentHeight,
    })
  }

  createEffect(
    () => {
      const parts = children()
      const series = parts.filter((part) => part.slot === 'series')
      const xAxis = parts.findLast((part) => part.slot === 'xAxis')
      const yAxis = parts.findLast((part) => part.slot === 'yAxis')
      const crosshair = parts.findLast((part) => part.slot === 'crosshair')
      const tooltip = parts.findLast((part) => part.slot === 'tooltip')
      const active = [...series, xAxis, yAxis, crosshair, tooltip].filter(
        (part) => part !== undefined,
      )

      return {
        series,
        xAxis,
        yAxis,
        crosshair,
        tooltip,
        active,
        data: props.data ?? empty,
        config: { ...options, duration: duration(), onRenderComplete },
      }
    },
    (next) => {
      let samplesChanged = releaseRemoved(active, next.active)
      active = next.active

      function mount<Engine extends ComponentCore<Datum[]>>(
        part: ChartPart<Engine, Datum[]>,
      ): Engine {
        const engine = part.mount()
        const data = part.data ?? next.data
        if (engine.datamodel.data !== data) {
          engine.setData(data)
          samplesChanged = true
        }
        return engine
      }

      const components = next.series.map(mount)
      const xAxis = next.xAxis && mount(next.xAxis)
      const yAxis = next.yAxis && mount(next.yAxis)
      const crosshair = next.crosshair && mount(next.crosshair)
      const tooltip = next.tooltip?.mount()

      attachTooltip(tooltip, host)
      plot ??= new XY(host)
      plot.updateContainer(
        {
          ...next.config,
          components,
          ...(xAxis && { xAxis }),
          ...(yAxis && { yAxis }),
          ...(crosshair && { crosshair }),
          ...(tooltip && { tooltip }),
        },
        true,
      )
      if (samplesChanged) {
        tooltip?.hide()
      }
      plot.render()
    },
  )
  onCleanup(() => {
    releaseRemoved(active, [])
    // The engine can finish its fonts-ready callback after disposal. Clear the axes it can render.
    plot?.updateContainer({ components: [] }, true)
    plot?.destroy()
  })

  return (
    <div
      ref={(element) => {
        host = element
      }}
      data-vis-xy-container=""
      class={props.class}
      style={plotStyle(props.style)}
    />
  )
}

export type SingleContainerProps<Data> = Omit<
  SingleContainerConfigInterface<Data>,
  'component' | 'tooltip' | 'annotations' | 'onRenderComplete'
> &
  PlotProps<Data>

export function SingleContainer<Data>(props: SingleContainerProps<Data>): JSX.Element {
  let host!: HTMLDivElement
  let plot: Single<Data | never[]> | undefined
  let active: ChartPartLifetime[] = []

  const options = omit(props, 'children', 'data', 'class', 'style', 'duration', 'onRenderComplete')
  const duration = createChartDuration(() => props.duration)
  const children = chartParts<never, Data>(() => props.children)
  function disposePlot(): void {
    // Release child engines before destroying their shared container.
    plot?.updateContainer({}, true)
    plot?.destroy()
    plot = undefined
  }

  const onRenderComplete: NonNullable<SingleContainerConfigInterface<Data>['onRenderComplete']> = (
    _svg,
    margin,
    containerWidth,
    containerHeight,
    componentWidth,
    componentHeight,
  ) => {
    props.onRenderComplete?.({
      margin: { ...margin },
      bleed: {},
      containerWidth,
      containerHeight,
      componentWidth,
      componentHeight,
    })
  }

  createEffect(
    () => {
      const parts = children()
      const mark = parts.findLast((part) => part.slot === 'single')
      const tooltip = mark && parts.findLast((part) => part.slot === 'tooltip')
      const active = [mark, tooltip].filter((part) => part !== undefined)

      return {
        mark,
        tooltip,
        active,
        data: mark?.data ?? props.data ?? empty,
        config: { ...options, duration: duration(), onRenderComplete },
      }
    },
    (next) => {
      releaseRemoved(active, next.active)
      active = next.active
      if (!next.mark) {
        disposePlot()
        return
      }

      const component = next.mark.mount()
      const tooltip = next.tooltip?.mount()
      attachTooltip(tooltip, host)
      plot ??= new Single(host)
      plot.updateContainer({ ...next.config, component, ...(tooltip && { tooltip }) }, true)
      if (component.datamodel.data !== next.data) {
        plot.setData(next.data, true)
      }
      plot.render()
    },
  )
  onCleanup(() => {
    releaseRemoved(active, [])
    disposePlot()
  })

  return (
    <div
      ref={(element) => {
        host = element
      }}
      data-vis-single-container=""
      class={props.class}
      style={plotStyle(props.style)}
    />
  )
}
