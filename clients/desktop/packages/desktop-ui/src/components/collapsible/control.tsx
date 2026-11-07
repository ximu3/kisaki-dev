/** @fileoverview Native disclosure with controlled state and optional exclusive details grouping. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { callHandler, classes } from '../../internal/dom'
import { createValue } from '../../internal/state'
import { Icon, mdiChevronRight } from '../../internal/icon/icon'
import styles from './styles.module.css'

/** name opts into native exclusive grouping; summary is the focusable disclosure label. */
export interface CollapsibleProps extends Omit<
  JSX.DetailsHtmlAttributes<HTMLDetailsElement>,
  'open'
> {
  summary: JSX.Element
  summaryClass?: string

  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

/** Native details owns activation and collapsed semantics. The content remains mounted. */
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
        <Icon path={mdiChevronRight} class={styles.chevron} />
        {local.summary}
      </summary>
      <div class={styles.content}>{local.children}</div>
    </details>
  )
}
