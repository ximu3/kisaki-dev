/** @fileoverview Native disclosure with controlled state and optional exclusive details grouping. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { callHandler, classes } from '../../internal/dom'
import { createValue } from '../../internal/state'
import { Icon, ChevronRight } from '../../internal/icon/glyph'
import styles from './styles.module.css'

/**
 * Native disclosure attributes with a focusable summary and controlled or local open state.
 *
 * The native name attribute opts into exclusive grouping.
 */
export interface CollapsibleProps extends Omit<
  JSX.DetailsHtmlAttributes<HTMLDetailsElement>,
  'open'
> {
  summary: JSX.Element
  summaryClass?: string

  open?: boolean
  defaultOpen?: boolean
  /** Reports an open-state change requested by native disclosure interaction. */
  onOpenChange?: (open: boolean) => void
}

/** Renders a native details disclosure whose content remains mounted while collapsed. */
export function Collapsible(props: CollapsibleProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'summary',
    'summaryClass',
    'open',
    'defaultOpen',
    'onOpenChange',
    'children',
    'class',
    'onToggle',
  ])

  /** Live disclosure state and change requests delegated to the controlled or local owner. */
  const [open, change] = createValue(
    () => local.open,
    () => local.defaultOpen ?? false,
    (next) => local.onOpenChange?.(next),
  )

  return (
    <details
      {...rest}
      open={open()}
      class={classes(styles.root, local.class)}
      onToggle={(event) => {
        if (event.currentTarget.open !== open()) {
          change(event.currentTarget.open)
        }
        callHandler(local.onToggle, event)
      }}
    >
      <summary class={classes(styles.summary, local.summaryClass)}>
        <Icon icon={ChevronRight} class={styles.chevron} />
        {local.summary}
      </summary>
      <div class={styles.content}>{local.children}</div>
    </details>
  )
}
