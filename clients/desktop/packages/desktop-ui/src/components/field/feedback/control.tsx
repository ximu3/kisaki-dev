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

/** The summary identifies the field in a complete correction. Its optional message explains that field's error. */
export interface FieldIssue {
  readonly id: string

  readonly summary: string
  readonly message?: string
}

/** An active field id selects its issue. Use null for the overview and undefined to retain context while reading feedback. */
export interface FormFeedbackProps extends JSX.HTMLAttributes<HTMLDivElement> {
  issues: readonly FieldIssue[]
  activeFieldId?: string | null | undefined
  onLocate: (id: string) => void

  /** Format the standalone error count when no erroneous field is active. */
  summary: (count: number) => string
  /** Explicit form-level feedback takes precedence over field and count prompts. */
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

function FeedbackPrompt(props: {
  text: string
  detail: string | undefined
  onLocate: () => void
}): JSX.Element {
  const tooltip = createTooltip()
  const id = createUniqueId()
  let trigger!: HTMLButtonElement
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
