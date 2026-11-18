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
  useContext,
} from 'solid-js'
import { Dynamic } from 'solid-js/web'
import type { JSX } from 'solid-js'
import { FormContext, type FieldIssue } from '../../../internal/form'
import { classes, createElementRef } from '../../../internal/dom'
import { TooltipSurface } from '../../../internal/tooltip/content'
import { createTooltip } from '../../../internal/tooltip/controller'
import styles from './styles.module.css'

/**
 * Form feedback inputs, localized count formatting and caller-owned field navigation.
 *
 * An active field ID selects its issue; null selects the overview, and undefined retains the
 * current context while feedback is read.
 */
export interface FormFeedbackProps extends JSX.HTMLAttributes<HTMLDivElement> {
  issues?: readonly FieldIssue[]
  activeFieldId?: string | null | undefined
  /** Requests that the caller reveal and focus the identified field. */
  onLocate?: (id: string) => void

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
  const form = useContext(FormContext)
  const [local, rest] = splitProps(props, [
    'issues',
    'activeFieldId',
    'summary',
    'onLocate',
    'message',
    'class',
  ])

  const issues = () => local.issues ?? form?.issues() ?? []
  const message = () => local.message ?? form?.message()
  const [remembered, setRemembered] = createSignal<string | null>(null)
  createEffect(() => {
    const active = local.activeFieldId !== undefined ? local.activeFieldId : form?.activeFieldId()
    if (active !== undefined) {
      setRemembered(active)
    }
  })

  const current = createMemo(() => issues().find((issue) => issue.id === remembered()))
  /**
   * Returns the explicit form message, active issue summary or formatted issue count in priority
   * order.
   */
  const text = () =>
    message() ?? current()?.summary ?? (issues().length ? local.summary(issues().length) : '')

  return (
    <div {...rest} class={classes(styles.root, local.class)} data-form-feedback>
      <Show when={message() || issues().length} fallback={<span role="status" />}>
        <FeedbackPrompt
          text={text()}
          detail={message() === undefined ? current()?.message : undefined}
          onLocate={
            message()
              ? undefined
              : () => (local.onLocate ?? form?.locate)?.(current()?.id ?? issues()[0]!.id)
          }
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
  onLocate: (() => void) | undefined
}): JSX.Element {
  const tooltip = createTooltip()
  const id = createUniqueId()
  const [trigger, bindTrigger] = createElementRef<HTMLElement>()
  let message!: HTMLSpanElement
  const [clipped, setClipped] = createSignal(false)
  const detail = () => (props.detail === props.text ? undefined : props.detail)

  onMount(() => {
    const measure = () => setClipped(message.scrollWidth > message.clientWidth)
    const size = new ResizeObserver(measure)
    size.observe(message)
    createEffect(on(() => props.text, measure))
    onCleanup(() => size.disconnect())
  })

  return (
    <>
      <Dynamic
        component={props.onLocate ? 'button' : 'span'}
        ref={bindTrigger}
        type={props.onLocate ? 'button' : undefined}
        tabIndex={!props.onLocate && clipped() ? 0 : undefined}
        class={styles.prompt}
        aria-label={props.text}
        aria-describedby={detail() ? id : undefined}
        onClick={() => {
          tooltip.dismiss()
          props.onLocate?.()
        }}
        onPointerEnter={() => tooltip.hover('trigger', true)}
        onPointerLeave={() => tooltip.hover('trigger', false)}
        onFocus={tooltip.focus}
        onBlur={tooltip.focus}
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
      </Dynamic>
      <Show when={detail() || clipped()}>
        <TooltipSurface
          id={id}
          reading={tooltip}
          anchor={trigger}
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
