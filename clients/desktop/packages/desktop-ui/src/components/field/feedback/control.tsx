/** @fileoverview Compact form feedback with direct field location and read-only hover details. */

import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  on,
  onCleanup,
  onMount,
  Show,
  splitProps,
} from 'solid-js'
import type { JSX } from 'solid-js'
import { classes } from '../../../internal/dom'
import { TooltipSurface } from '../../../internal/tooltip/content'
import { createTooltip } from '../../../internal/tooltip/controller'
import styles from './styles.module.css'

/** summary identifies the field in a complete correction. message can supply a more detailed correction. */
export interface FieldIssue {
  readonly id: string

  readonly summary: string
  readonly message?: string
}

/** undefined activeFieldId retains feedback focus, null indicates a different valid field. */
export interface FormFeedbackProps extends JSX.HTMLAttributes<HTMLDivElement> {
  issues: readonly FieldIssue[]
  activeFieldId?: string | null | undefined
  onLocate: (id: string) => void

  /** Format a multi-issue prompt, including the remaining count when a field is active. */
  summary: (count: number, current: FieldIssue | undefined) => string
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

    if (local.issues.length > 1) {
      return local.summary(local.issues.length, current())
    }
    return local.issues[0]?.summary ?? ''
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
  let message!: HTMLSpanElement
  const [clipped, setClipped] = createSignal(false)
  const hasDetails = () =>
    props.issues.length > 1 ||
    clipped() ||
    props.issues.some((issue) => (issue.message ?? issue.summary) !== props.text)

  onMount(() => {
    const measure = () => setClipped(message.scrollWidth > message.clientWidth)
    const size = new ResizeObserver(measure)
    size.observe(message)
    createEffect(on(() => props.text, measure))
    onCleanup(() => size.disconnect())
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
        aria-describedby={hasDetails() ? id : undefined}
        onClick={() => {
          tooltip.dismiss()
          props.onLocate()
        }}
        onPointerEnter={() => tooltip.hover('trigger', true)}
        onPointerLeave={() => tooltip.hover('trigger', false)}
        onFocus={() => tooltip.focus(true)}
        onBlur={() => tooltip.focus(false)}
      >
        <span
          ref={(node) => {
            message = node
          }}
          class={styles.message}
          role="status"
        >
          {props.text}
        </span>
      </button>
      <Show when={hasDetails()}>
        <TooltipSurface
          id={id}
          reading={tooltip}
          anchor={() => trigger}
          placement="top-start"
          class={styles.details}
        >
          <ul>
            <For each={props.issues}>{(issue) => <li>{issue.message ?? issue.summary}</li>}</For>
          </ul>
        </TooltipSurface>
      </Show>
    </>
  )
}
