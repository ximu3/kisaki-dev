/** @fileoverview Compact form feedback with direct field location and read-only hover details. */

import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
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

/** Field-specific correction with a standalone summary and optional detailed error message. */
export interface FieldIssue {
  readonly id: string

  readonly summary: string
  readonly message?: string
}

/**
 * Form feedback inputs, localized count formatting and caller-owned field navigation.
 *
 * An active field ID selects its issue; null selects the overview, and undefined retains the
 * current context while feedback is read.
 */
export interface FormFeedbackProps extends JSX.HTMLAttributes<HTMLDivElement> {
  issues: readonly FieldIssue[]
  activeFieldId?: string | null | undefined
  /** Requests that the caller reveal and focus the identified field. */
  onLocate: (id: string) => void

  /** Formats a standalone error-count message when no erroneous field is active. */
  summary: (count: number) => string
  /** Explicit form-level feedback takes precedence over field and count prompts. */
  message?: string
}

/**
 * Reserves one feedback row and selects form-level, field-specific or error-count content.
 *
 * The caller owns validation and revealing the requested field.
 */
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
  /**
   * Returns the explicit form message, active issue summary or formatted issue count in priority
   * order.
   */
  const text = () =>
    local.message ??
    current()?.summary ??
    (local.issues.length ? local.summary(local.issues.length) : '')

  return (
    <div {...rest} class={classes(styles.root, local.class)}>
      <Show when={local.issues.length} fallback={<span role="status">{text()}</span>}>
        <FeedbackPrompt
          text={text()}
          detail={local.message === undefined ? current()?.message : undefined}
          onLocate={() => local.onLocate(current()?.id ?? local.issues[0]!.id)}
        />
      </Show>
    </div>
  )
}

/** Renders a field-location button with read-only tooltip details for extra or clipped text. */
function FeedbackPrompt(props: {
  text: string
  detail: string | undefined
  /** Reveals the selected field after tooltip dismissal. */
  onLocate: () => void
}): JSX.Element {
  const tooltip = createTooltip()
  const id = createUniqueId()
  let trigger!: HTMLButtonElement
  let message!: HTMLSpanElement
  const [clipped, setClipped] = createSignal(false)
  /** Returns supplemental error detail only when it differs from the visible summary. */
  const detail = () => (props.detail === props.text ? undefined : props.detail)

  onMount(() => {
    /** Updates whether the visible feedback text exceeds its available width. */
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
        aria-describedby={detail() ? id : undefined}
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
      <Show when={detail() || clipped()}>
        <TooltipSurface
          id={id}
          reading={tooltip}
          anchor={() => trigger}
          placement="top-start"
          class={styles.details}
        >
          <Show when={clipped() && detail()}>
            <p aria-hidden="true">{props.text}</p>
          </Show>
          <p>{detail() || props.text}</p>
        </TooltipSurface>
      </Show>
    </>
  )
}
