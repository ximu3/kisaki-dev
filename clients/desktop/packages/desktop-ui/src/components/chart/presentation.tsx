import { For, omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import styles from './styles.module.css'

export interface ChartProps extends JSX.HTMLAttributes<HTMLElement> {
  label: string
  summary: string
}

export function Chart(props: ChartProps): JSX.Element {
  const rest = omit(props, 'label', 'summary', 'children', 'class')

  return (
    <figure {...rest} aria-label={props.label} class={[styles.root, props.class]}>
      {props.children}
      <figcaption class={styles.summary}>{props.summary}</figcaption>
    </figure>
  )
}

export interface ChartLegendItem {
  readonly id: string
  readonly label: string
  readonly color: string
  readonly selected: boolean
}

export interface ChartLegendProps {
  label: string
  items: readonly ChartLegendItem[]
  onToggle: (id: string) => void
  class?: string
}

export function ChartLegend(props: ChartLegendProps): JSX.Element {
  return (
    <div role="group" aria-label={props.label} class={[styles.legend, props.class]}>
      <For each={props.items}>
        {(item) => (
          <button
            type="button"
            aria-pressed={item.selected ? 'true' : 'false'}
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
