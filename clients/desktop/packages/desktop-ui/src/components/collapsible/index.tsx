import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { callHandler } from '../../internal/dom'
import { createValue } from '../../internal/state'
import { Icon, ChevronRight } from '../../internal/icon/glyph'
import styles from './styles.module.css'

/** Interactive content inside a summary keeps its own native click action. */
const activationTargets =
  'summary, a[href], audio[controls], button, details, embed, iframe, img[usemap], input:not([type=hidden]), label, select, textarea, video[controls]'

/**
 * Native disclosure attributes with a focusable summary and controlled or local open state.
 *
 * Callers using the same native name keep at most one controlled member open.
 */
export interface CollapsibleProps extends Omit<
  JSX.DetailsHtmlAttributes<HTMLDetailsElement>,
  'open'
> {
  summary: JSX.Element
  summaryClass?: string

  open?: boolean
  defaultOpen?: boolean
  /** Requests the next state. In controlled mode the caller adopts it through open. */
  onOpenChange?: (open: boolean) => void
}

/** Renders a native details disclosure whose content remains mounted while collapsed. */
export function Collapsible(props: CollapsibleProps): JSX.Element {
  const rest = omit(
    props,
    'summary',
    'summaryClass',
    'open',
    'defaultOpen',
    'onOpenChange',
    'children',
    'class',
    'onClick',
    'onToggle',
  )

  const [open, change] = createValue(
    () => props.open,
    () => props.defaultOpen ?? false,
    (next) => props.onOpenChange?.(next),
  )
  let summary!: HTMLElement

  return (
    <details
      {...rest}
      open={open()}
      class={[styles.root, props.class]}
      onClick={(event) => {
        callHandler(props.onClick, event)
        if (props.open === undefined || event.defaultPrevented) {
          return
        }

        const target = event
          .composedPath()
          .find((node) => node instanceof Element && node.matches(activationTargets))
        if (target === summary) {
          // Ask before the browser toggles this disclosure and closes a named sibling.
          event.preventDefault()
          change(!open())
        }
      }}
      onToggle={(event) => {
        const details = event.currentTarget
        if (details.open !== open()) {
          // Native grouping can also close this member when another disclosure opens.
          change(details.open)
          queueMicrotask(() => {
            details.open = open()
          })
        }
        callHandler(props.onToggle, event)
      }}
    >
      <summary
        ref={(node) => {
          summary = node
        }}
        class={[styles.summary, props.summaryClass]}
      >
        <Icon icon={ChevronRight} class={styles.chevron} />
        {props.summary}
      </summary>
      <div class={styles.content}>{props.children}</div>
    </details>
  )
}
