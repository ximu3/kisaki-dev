/** @fileoverview Adds shared chart presentation to Unovis's public Solid components. */

import { For, Show, splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { Button } from './components/button'
import {
  VisXYContainer as NativeXYContainer,
  type VisXYContainerProps as NativeXYContainerProps,
} from '@unovis/solid/containers/xy-container'
import {
  VisSingleContainer as NativeSingleContainer,
  type VisSingleContainerProps as NativeSingleContainerProps,
} from '@unovis/solid/containers/single-container'
import {
  VisTooltip as NativeTooltip,
  type VisTooltipProps as NativeTooltipProps,
} from '@unovis/solid/components/tooltip'
import {
  VisCrosshair as NativeCrosshair,
  type VisCrosshairProps as NativeCrosshairProps,
} from '@unovis/solid/components/crosshair'
import type { Spacing } from '@unovis/ts'

// Keep chart algorithms, reactive updates and instance disposal in the official Solid adapter.
export { VisAxis } from '@unovis/solid/components/axis'
export type { VisAxisProps } from '@unovis/solid/components/axis'
export { VisLine, VisLineSelectors } from '@unovis/solid/components/line'
export type { VisLineProps } from '@unovis/solid/components/line'
export { VisArea, VisAreaSelectors } from '@unovis/solid/components/area'
export type { VisAreaProps } from '@unovis/solid/components/area'
export { VisGroupedBar, VisGroupedBarSelectors } from '@unovis/solid/components/grouped-bar'
export type { VisGroupedBarProps } from '@unovis/solid/components/grouped-bar'
export { VisStackedBar, VisStackedBarSelectors } from '@unovis/solid/components/stacked-bar'
export type { VisStackedBarProps } from '@unovis/solid/components/stacked-bar'
export { VisScatter, VisScatterSelectors } from '@unovis/solid/components/scatter'
export type { VisScatterProps } from '@unovis/solid/components/scatter'
export { VisDonut, VisDonutSelectors } from '@unovis/solid/components/donut'
export type { VisDonutProps } from '@unovis/solid/components/donut'
export { CurveType } from '@unovis/ts'

/** Read-only geometry available when calculating chart bleed, without transferring a native instance. */
export interface ChartComponentGeometry {
  readonly bleed: Readonly<Spacing>
}

/** Native data and layout configuration; visualization instances are supplied by Solid descendants. */
export type VisXYContainerProps<Datum> = Omit<
  NativeXYContainerProps<Datum>,
  'components' | 'xAxis' | 'yAxis' | 'tooltip' | 'crosshair' | 'annotations' | 'bleed'
> & {
  bleed?: Spacing | ((components: readonly ChartComponentGeometry[]) => Spacing)
}

/** Retain the native adapter's reactive lifecycle with one owner for all descendant instances. */
export const VisXYContainer: <Datum>(props: VisXYContainerProps<Datum>) => JSX.Element =
  NativeXYContainer

/** Native single-chart configuration; component, tooltip and annotations belong to Solid descendants. */
export type VisSingleContainerProps<Datum> = Omit<
  NativeSingleContainerProps<Datum>,
  'component' | 'tooltip' | 'annotations'
>

/** Retain the native single-container lifecycle without accepting external resource ownership. */
export const VisSingleContainer: <Datum>(props: VisSingleContainerProps<Datum>) => JSX.Element =
  NativeSingleContainer

/** Native tooltip behavior and content; the container supplies the owned visualization components. */
export type VisTooltipProps = Omit<NativeTooltipProps, 'components'>

/** Register one tooltip with its owning Solid chart container. */
export const VisTooltip: (props: VisTooltipProps) => JSX.Element = NativeTooltip

/** Native crosshair configuration; its tooltip is created and released by the adapter. */
export type VisCrosshairProps<Datum> = Omit<NativeCrosshairProps<Datum>, 'tooltip'>

/** Keep crosshair geometry and interaction in the native adapter. */
export const VisCrosshair: <Datum>(props: VisCrosshairProps<Datum>) => JSX.Element = NativeCrosshair

/** A chart's semantic figure. The caller supplies a caption or accessible name and meaningful text alternatives. */
export type ChartProps = JSX.HTMLAttributes<HTMLElement>

/** Apply the appearance vocabulary without choosing data, aggregation, axes or business interactions. */
export function Chart(props: ChartProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <figure
      {...rest}
      class={twMerge(
        'kisaki-chart relative m-0 min-w-0 font-ui text-sm text-foreground',
        local.class,
      )}
    />
  )
}

/** Describe the chart's meaning or result in ordinary readable content. */
export function ChartCaption(props: JSX.HTMLAttributes<HTMLElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])
  return <figcaption {...rest} class={twMerge('mt-2 text-xs text-muted-foreground', local.class)} />
}

/** One host-owned series; its color is also passed to the matching Unovis accessor. */
export interface ChartLegendItem {
  readonly label: string
  readonly color: string
  readonly inactive?: boolean
}

/** A passive legend or keyboard-accessible series choices. Selection remains controlled by the host. */
export type ChartLegendProps = Omit<JSX.HTMLAttributes<HTMLUListElement>, 'children'> & {
  items: readonly ChartLegendItem[]
  onItemClick?: (item: ChartLegendItem, index: number) => void
}

/** Use real buttons for interactive legends; the callback does not imply a data query or persistence. */
export function ChartLegend(props: ChartLegendProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'items', 'onItemClick'])

  return (
    <ul
      {...rest}
      class={twMerge(
        'm-0 flex list-none flex-wrap items-center gap-x-3 gap-y-1 p-0 font-ui text-xs',
        local.class,
      )}
    >
      <For each={local.items}>
        {(item, index) => (
          <li>
            <Show
              when={local.onItemClick}
              fallback={
                <span
                  class="inline-flex items-center gap-1.5"
                  classList={{ 'opacity-50': item.inactive }}
                >
                  <span
                    aria-hidden="true"
                    class="size-2 shrink-0 rounded-full"
                    style={{ background: item.color }}
                  />
                  {item.label}
                </span>
              }
            >
              <Button
                variant="ghost"
                size="xs"
                aria-pressed={!item.inactive}
                class={item.inactive ? 'opacity-50' : undefined}
                onClick={() => local.onItemClick?.(item, index())}
              >
                <span
                  aria-hidden="true"
                  class="size-2 shrink-0 rounded-full"
                  style={{ background: item.color }}
                />
                {item.label}
              </Button>
            </Show>
          </li>
        )}
      </For>
    </ul>
  )
}

/** Text-only tooltip content; format and units are decided by the caller. */
export interface ChartTooltipData {
  readonly title?: string
  readonly rows: readonly {
    readonly label: string
    readonly value: string
    readonly color?: string
  }[]
}

/** Create safe DOM content for a Unovis tooltip callback without interpolating data into HTML. */
export function createChartTooltip(data: ChartTooltipData): HTMLDivElement {
  const content = document.createElement('div')
  content.className = 'flex flex-col gap-1 font-ui text-xs'

  if (data.title !== undefined) {
    const title = document.createElement('div')
    title.className = 'mb-1 font-medium'
    title.textContent = data.title
    content.append(title)
  }

  for (const row of data.rows) {
    const entry = document.createElement('div')
    entry.className = 'flex items-center gap-2'
    if (row.color !== undefined) {
      const marker = document.createElement('span')
      marker.className = 'size-2 shrink-0 rounded-full'
      marker.style.background = row.color
      marker.setAttribute('aria-hidden', 'true')
      entry.append(marker)
    }
    const label = document.createElement('span')
    label.className = 'flex-1 text-muted-foreground'
    label.textContent = row.label
    const value = document.createElement('span')
    value.className = 'font-medium tabular-nums'
    value.textContent = row.value
    entry.append(label, value)
    content.append(entry)
  }
  return content
}
