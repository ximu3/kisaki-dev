/** @fileoverview Compact form feedback with direct field location and read-only hover details. */

import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  Show,
  splitProps,
} from 'solid-js'
import type { JSX } from 'solid-js'
import { classes } from '../../internal/dom'
import { Icon, mdiAlertCircleOutline } from '../../internal/icons'
import { createPopup } from '../../internal/popup'
import { createTooltip } from '../../internal/tooltip'
import tooltipStyles from '../tooltip/styles.module.css'
import styles from './feedback.module.css'

/** summary is a concise correction; message retains the full explanation. */
export interface FieldIssue {
  readonly id: string
  readonly label: string

  readonly summary: string
  readonly message: string
}

/** undefined activeFieldId retains feedback focus, null indicates a different valid field. */
export interface FormFeedbackProps extends JSX.HTMLAttributes<HTMLDivElement> {
  issues: readonly FieldIssue[]
  activeFieldId?: string | null | undefined
  onLocate: (id: string) => void

  summary: (count: number) => string
  message?: string
}

/** Reserve one control row. The caller owns validation and revealing the located field. */
export function FormFeedback(props: FormFeedbackProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'issues',
    'activeFieldId',
    'summary',
    'onLocate',
    'message',
    'class',
  ])

  const [remembered, setRemembered] = createSignal<string | null>(null)
  createEffect(() => {
    if (local.activeFieldId !== undefined) {
      setRemembered(local.activeFieldId)
    }
  })

  const current = createMemo(() => local.issues.find((issue) => issue.id === remembered()))
  const text = () => {
    if (local.message !== undefined) {
      return local.message
    }

    const issue = current()
    if (issue) {
      return `${issue.label}: ${issue.summary}`
    }

    return local.issues.length ? local.summary(local.issues.length) : ''
  }

  return (
    <div {...rest} class={classes(styles.root, local.class)}>
      <Show when={local.issues.length} fallback={<span role="status">{text()}</span>}>
        <FeedbackPrompt
          issues={local.issues}
          text={text()}
          onLocate={() => local.onLocate(current()?.id ?? local.issues[0]!.id)}
        />
      </Show>
    </div>
  )
}

function FeedbackPrompt(props: {
  issues: readonly FieldIssue[]
  text: string
  onLocate: () => void
}): JSX.Element {
  const tooltip = createTooltip(() => 300)
  const id = createUniqueId()
  let trigger!: HTMLButtonElement
  let content!: HTMLDivElement

  createPopup({
    element: () => content,
    anchor: () => trigger,
    open: tooltip.open,
    change: (open) => {
      if (!open) {
        tooltip.dismiss()
      }
    },
    placement: () => 'top-start',
    restoreFocus: false,
  })

  return (
    <>
      <button
        ref={(node) => {
          trigger = node
        }}
        type="button"
        class={styles.prompt}
        aria-label={props.text}
        aria-describedby={id}
        onClick={props.onLocate}
        onFocus={() => tooltip.focus(true)}
        onBlur={() => tooltip.focus(false)}
      >
        <span class={styles.message} role="status" aria-live="polite">
          {props.text}
        </span>
        <span
          class={styles.icon}
          onPointerEnter={() => tooltip.hover('trigger', true)}
          onPointerLeave={() => tooltip.hover('trigger', false)}
        >
          <Icon path={mdiAlertCircleOutline} />
        </span>
      </button>
      <div
        ref={(node) => {
          content = node
        }}
        id={id}
        popover="manual"
        role="tooltip"
        class={classes(tooltipStyles.root, styles.details)}
        onPointerEnter={() => tooltip.hover('content', true)}
        onPointerLeave={() => tooltip.hover('content', false)}
      >
        <ul>
          <For each={props.issues}>
            {(issue) => (
              <li>
                <strong>{issue.label}</strong>
                <p>{issue.message}</p>
              </li>
            )}
          </For>
        </ul>
      </div>
    </>
  )
}
