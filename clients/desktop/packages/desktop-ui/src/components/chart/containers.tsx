/** @fileoverview Solid chart containers accept child components and expose only layout snapshots. */

import { createSignal, onCleanup, onMount, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { VisXYContainer, VisSingleContainer } from '@unovis/solid'
import type { VisXYContainerProps, VisSingleContainerProps } from '@unovis/solid'
import type { Spacing } from '@unovis/ts'

/** Follow the document's motion preference and release its listener with the chart. */
function createAnimation(duration: () => number | undefined): () => { duration?: number } {
  const [reduced, setReduced] = createSignal(false)
  onMount(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const changed = () => setReduced(query.matches)
    changed()
    query.addEventListener('change', changed)
    onCleanup(() => query.removeEventListener('change', changed))
  })

  return () => {
    if (reduced()) {
      return { duration: 0 }
    }

    const value = duration()
    return value === undefined ? {} : { duration: value }
  }
}

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
  const animation = createAnimation(() => local.duration)

  return (
    <VisXYContainer
      {...rest}
      {...animation()}
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
  const animation = createAnimation(() => local.duration)

  return (
    <VisSingleContainer
      {...rest}
      {...animation()}
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
