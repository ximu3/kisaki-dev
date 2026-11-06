/** @fileoverview Solid chart containers accept child components and expose only layout snapshots. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { VisXYContainer, VisSingleContainer } from '@unovis/solid'
import type { VisXYContainerProps, VisSingleContainerProps } from '@unovis/solid'
import type { Spacing } from '@unovis/ts'

import { createChartDuration } from './motion'

/** Read-only CSS-pixel geometry from one completed chart render. */
export interface ChartGeometry {
  readonly margin: Readonly<Spacing>
  readonly bleed: Readonly<Spacing>

  readonly containerWidth: number
  readonly containerHeight: number

  readonly componentWidth: number
  readonly componentHeight: number
}

/** Child Solid components own their instances; callers supply data and public presentation configuration. */
export type XYContainerProps<Datum> = Omit<
  VisXYContainerProps<Datum>,
  | 'components'
  | 'xAxis'
  | 'yAxis'
  | 'tooltip'
  | 'crosshair'
  | 'annotations'
  | 'bleed'
  | 'onRenderComplete'
> & {
  bleed?: Readonly<Spacing>
  onRenderComplete?: (geometry: ChartGeometry) => void
}

/** Lifecycle and data updates are handled by the official Solid adapter. */
export function XYContainer<Datum>(props: XYContainerProps<Datum>): JSX.Element {
  const [local, rest] = splitProps(props, ['onRenderComplete', 'duration'])
  const duration = createChartDuration(() => local.duration)

  return (
    <VisXYContainer
      {...rest}
      duration={duration()}
      onRenderComplete={(
        _svg,
        margin,
        bleed,
        containerWidth,
        containerHeight,
        componentWidth,
        componentHeight,
      ) =>
        local.onRenderComplete?.({
          margin: { ...margin },
          bleed: { ...bleed },
          containerWidth,
          containerHeight,
          componentWidth,
          componentHeight,
        })
      }
    />
  )
}

/** Single visual child, with lifecycle owned by its Solid composition. */
export type SingleContainerProps<Datum> = Omit<
  VisSingleContainerProps<Datum>,
  'component' | 'tooltip' | 'annotations' | 'onRenderComplete'
> & { onRenderComplete?: (geometry: ChartGeometry) => void }

/** Compose a Donut and optional tooltip without constructing an external engine object. */
export function SingleContainer<Datum>(props: SingleContainerProps<Datum>): JSX.Element {
  const [local, rest] = splitProps(props, ['onRenderComplete', 'duration'])
  const duration = createChartDuration(() => local.duration)

  return (
    <VisSingleContainer
      {...rest}
      duration={duration()}
      onRenderComplete={(
        _svg,
        margin,
        containerWidth,
        containerHeight,
        componentWidth,
        componentHeight,
      ) =>
        local.onRenderComplete?.({
          margin: { ...margin },
          bleed: {},
          containerWidth,
          containerHeight,
          componentWidth,
          componentHeight,
        })
      }
    />
  )
}
