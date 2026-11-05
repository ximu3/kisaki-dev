/** @fileoverview Named and described chart frames; all engine instances belong to Unovis Solid. */

import { createUniqueId, createSignal, onCleanup, splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import {
  VisSingleContainer,
  VisXYContainer,
  type VisSingleContainerProps,
  type VisXYContainerProps,
} from '@unovis/solid'

interface ChartDescription {
  label: string
  summary: string
  children: JSX.Element
  class?: string
}

/** Layout delivered after rendering, in CSS pixels, without transferring engine or DOM ownership. */
export interface ChartGeometry {
  readonly width: number
  readonly height: number
  readonly plotWidth: number
  readonly plotHeight: number
  readonly margin: Readonly<NonNullable<VisSingleContainerProps<unknown>['margin']>>
}

export type XYChartProps<D> = ChartDescription &
  Pick<
    VisXYContainerProps<D>,
    | 'data'
    | 'width'
    | 'height'
    | 'margin'
    | 'padding'
    | 'duration'
    | 'xDomain'
    | 'yDomain'
    | 'xScale'
    | 'yScale'
    | 'colorFunction'
  > & {
    onLayout?: (geometry: ChartGeometry & { readonly bleed: ChartGeometry['margin'] }) => void
  }
export type SingleChartProps<D> = ChartDescription &
  Pick<
    VisSingleContainerProps<D>,
    'data' | 'width' | 'height' | 'margin' | 'padding' | 'duration' | 'colorFunction'
  > & {
    onLayout?: (geometry: ChartGeometry) => void
  }

/** Override engine transitions while the user's reduced-motion preference is active. */
function motionConfig(): () => { duration?: number } {
  const query = matchMedia('(prefers-reduced-motion: reduce)')
  const [reduced, setReduced] = createSignal(query.matches)
  const update = () => setReduced(query.matches)
  query.addEventListener('change', update)
  onCleanup(() => query.removeEventListener('change', update))
  return () => (reduced() ? { duration: 0 } : {})
}

/** Provide inherited theme variables and an accessible text alternative to the SVG. */
function ChartFrame(props: ChartDescription): JSX.Element {
  const id = createUniqueId()

  return (
    <figure
      aria-label={props.label}
      aria-describedby={id}
      class={twMerge('ks-chart m-0 min-w-0', props.class)}
    >
      {props.children}
      <figcaption id={id} class="sr-only">
        {props.summary}
      </figcaption>
    </figure>
  )
}

/** Compose XY series, axes, crosshair and tooltip as children of their official Solid adapter. */
export function XYChart<D>(props: XYChartProps<D>): JSX.Element {
  const motion = motionConfig()
  const [frame, config] = splitProps(props, ['label', 'summary', 'class', 'onLayout'])

  return (
    <ChartFrame {...frame}>
      <VisXYContainer
        {...config}
        {...motion()}
        onRenderComplete={(_svg, margin, bleed, width, height, plotWidth, plotHeight) =>
          frame.onLayout?.({
            width,
            height,
            plotWidth,
            plotHeight,
            margin: { ...margin },
            bleed: { ...bleed },
          })
        }
      />
    </ChartFrame>
  )
}

/** Own a single visualization such as a donut through its Solid container. */
export function SingleChart<D>(props: SingleChartProps<D>): JSX.Element {
  const motion = motionConfig()
  const [frame, config] = splitProps(props, ['label', 'summary', 'class', 'onLayout'])

  return (
    <ChartFrame {...frame}>
      <VisSingleContainer
        {...config}
        {...motion()}
        onRenderComplete={(_svg, margin, width, height, plotWidth, plotHeight) =>
          frame.onLayout?.({ width, height, plotWidth, plotHeight, margin: { ...margin } })
        }
      />
    </ChartFrame>
  )
}
