/** @fileoverview Chart theme, accessible text alternatives and caller-owned interactive legends. */

import { For, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { classes } from '../../internal/dom'
import styles from './styles.module.css'

/** A text summary accompanies visual data; statistics, units and selection are supplied by the host. */
export interface ChartProps extends JSX.HTMLAttributes<HTMLElement> {
  label: string
  summary: string
}

/** Theme an Unovis Solid composition without accepting or retaining external engine instances. */
export function Chart(props: ChartProps): JSX.Element {
  const [local, rest] = splitProps(props, ['label', 'summary', 'children', 'class'])

  return (
    <figure {...rest} aria-label={local.label} class={classes(styles.root, local.class)}>
      {local.children}
      <figcaption class={styles.summary}>{local.summary}</figcaption>
    </figure>
  )
}

/** Series identity and selection are separate from its color and display label. */
export interface ChartLegendItem {
  readonly id: string
  readonly label: string
  readonly color: string
  readonly selected: boolean
}

/** The host updates selected items and the corresponding chart data/configuration. */
export interface ChartLegendProps {
  label: string
  items: readonly ChartLegendItem[]
  onToggle: (id: string) => void
  class?: string
}

/** Interactive legend buttons expose their pressed state and preserve keyboard activation. */
export function ChartLegend(props: ChartLegendProps): JSX.Element {
  return (
    <div role="group" aria-label={props.label} class={classes(styles.legend, props.class)}>
      <For each={props.items}>
        {(item) => (
          <button
            type="button"
            aria-pressed={item.selected}
            onClick={() => props.onToggle(item.id)}
          >
            <span aria-hidden="true" style={{ background: item.color }} />
            {item.label}
          </button>
        )}
      </For>
    </div>
  )
}

/** Create safe text-only tooltip content in the chart's document; data is never interpreted as HTML. */
export function chartTooltipContent(
  document: Document,
  rows: readonly { label: string; value: string }[],
): HTMLElement {
  const content = document.createElement('dl')
  content.className = styles.tooltip ?? ''
  for (const row of rows) {
    const term = document.createElement('dt')
    const value = document.createElement('dd')
    term.textContent = row.label
    value.textContent = row.value
    content.append(term, value)
  }

  return content
}
