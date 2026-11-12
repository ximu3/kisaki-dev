/** @fileoverview Chart theme, accessible text alternatives and caller-owned interactive legends. */

import { For, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { classes } from '../../internal/dom'
import styles from './styles.module.css'

/** Figure attributes with an accessible chart label and a visible text summary. */
export interface ChartProps extends JSX.HTMLAttributes<HTMLElement> {
  label: string
  summary: string
}

/** Wraps a Solid chart composition in the shared theme and its text alternative. */
export function Chart(props: ChartProps): JSX.Element {
  const [local, rest] = splitProps(props, ['label', 'summary', 'children', 'class'])

  return (
    <figure {...rest} aria-label={local.label} class={classes(styles.root, local.class)}>
      {local.children}
      <figcaption class={styles.summary}>{local.summary}</figcaption>
    </figure>
  )
}

/** Series identity, display label and color with caller-owned selection state. */
export interface ChartLegendItem {
  readonly id: string
  readonly label: string
  readonly color: string
  readonly selected: boolean
}

/** Labeled legend items and a callback through which the host changes selection. */
export interface ChartLegendProps {
  label: string
  items: readonly ChartLegendItem[]
  /**
   * Requests a selection change for the identified series; the host updates items and chart data.
   */
  onToggle: (id: string) => void
  class?: string
}

/** Renders keyboard-activatable legend buttons with their current pressed states. */
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

/**
 * Creates a text-only tooltip description list in the supplied document.
 *
 * Labels and values are inserted as text rather than interpreted as HTML.
 */
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
