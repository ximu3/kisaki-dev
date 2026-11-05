/** @fileoverview Text-only tooltip adapters and keyboard-accessible, controlled series legends. */

import { For, createMemo, splitProps, type JSX } from 'solid-js'
import {
  VisCrosshair,
  VisTooltip,
  type VisCrosshairProps,
  type VisTooltipProps,
} from '@unovis/solid'
import { Button } from '../button'

/** Unovis accepts HTML strings. Data-derived text is always placed in a text node instead. */
function tooltipText(text: string): HTMLElement {
  const element = document.createElement('span')
  element.textContent = text
  return element
}

export type ChartTooltipProps = Pick<
  VisTooltipProps,
  'showDelay' | 'hideDelay' | 'horizontalPlacement' | 'verticalPlacement'
> & {
  triggers?: Readonly<Record<string, (datum: unknown, index: number) => string | undefined>>
}

/** Map Unovis mark selectors to plain-text labels. Crosshairs use the same tooltip instance. */
export function ChartTooltip(props: ChartTooltipProps): JSX.Element {
  const [local, config] = splitProps(props, ['triggers'])
  const triggers = createMemo(() =>
    Object.fromEntries(
      Object.entries(local.triggers ?? {}).map(([selector, format]) => [
        selector,
        (datum: unknown, index: number) => {
          const text = format(datum, index)
          return text === undefined ? undefined : tooltipText(text)
        },
      ]),
    ),
  )
  return <VisTooltip {...config} triggers={triggers()} className="ks-chart-tooltip" />
}

export type ChartCrosshairProps<D> = Omit<VisCrosshairProps<D>, 'tooltip' | 'template'> & {
  /** With free movement the nearest datum can be absent. */
  format: (
    datum: D | undefined,
    x: number | Date,
    data: readonly D[],
    leftNearestIndex?: number,
  ) => string
}

/** Describe the pointed position using plain text; the enclosing chart owns its Tooltip. */
export function ChartCrosshair<D>(props: ChartCrosshairProps<D>): JSX.Element {
  const [local, config] = splitProps(props, ['format'])

  return (
    <VisCrosshair<D>
      {...config}
      template={(datum, x, data, index) => tooltipText(local.format(datum, x, data, index))}
    />
  )
}

export interface ChartLegendItem {
  key: string
  label: string
  color: string
  selected: boolean
}

/** Let the host choose which series to display; selection is exposed to assistive technology. */
export function ChartLegend(props: {
  label: string
  items: readonly ChartLegendItem[]
  onToggle: (key: string) => void
}): JSX.Element {
  return (
    <div role="group" aria-label={props.label} class="flex flex-wrap gap-1">
      <For each={props.items}>
        {(item) => (
          <Button
            variant="ghost"
            size="xs"
            aria-pressed={item.selected}
            class="aria-pressed:bg-accent"
            onClick={() => props.onToggle(item.key)}
          >
            <span
              aria-hidden="true"
              class="size-2 rounded-full"
              style={{ 'background-color': item.color }}
            />
            {item.label}
          </Button>
        )}
      </For>
    </div>
  )
}
