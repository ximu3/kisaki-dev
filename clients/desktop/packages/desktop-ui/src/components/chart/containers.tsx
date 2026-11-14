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

/** Data and public layout options for a Solid-owned XY chart composition. */
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
  /** Receives copied layout geometry when the container reports render completion. */
  onRenderComplete?: (geometry: ChartGeometry) => void
}

/**
 * Composes XY chart children through the official Solid adapter and publishes copied render
 * geometry.
 *
 * Animation duration follows the document's reduced-motion preference.
 */
export function XYContainer<Datum>(props: XYContainerProps<Datum>): JSX.Element {
  const [local, rest] = splitProps(props, ['onRenderComplete', 'duration'])
  /** Reactive chart-transition duration honoring the current reduced-motion preference. */
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

/** Data and public layout options for a Solid-owned single-chart composition. */
export type SingleContainerProps<Datum> = Omit<
  VisSingleContainerProps<Datum>,
  'component' | 'tooltip' | 'annotations' | 'onRenderComplete'
> & {
  /** Receives copied layout geometry when the container reports render completion. */
  onRenderComplete?: (geometry: ChartGeometry) => void
}

/**
 * Composes a single chart and optional tooltip through the official Solid adapter.
 *
 * Render geometry is copied, and animation duration follows reduced-motion preferences.
 */
export function SingleContainer<Datum>(props: SingleContainerProps<Datum>): JSX.Element {
  const [local, rest] = splitProps(props, ['onRenderComplete', 'duration'])
  /** Reactive chart-transition duration honoring the current reduced-motion preference. */
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
