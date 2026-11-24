import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  onSettled,
  Show,
  omit,
  useContext,
} from 'solid-js'
import { dynamic, type JSX } from '@solidjs/web'
import { FormContext, type FieldIssue } from '../../../internal/form'
import { TooltipSurface } from '../../../internal/tooltip/content'
import { createTooltip } from '../../../internal/tooltip/controller'
import styles from './styles.module.css'

export interface FormFeedbackProps extends JSX.HTMLAttributes<HTMLDivElement> {
  issues?: readonly FieldIssue[]
  activeFieldId?: string | null | undefined
  onLocate?: (id: string) => void

  summary: (count: number) => string
  message?: string
}

export function FormFeedback(props: FormFeedbackProps): JSX.Element {
  const form = useContext(FormContext)
  const rest = omit(props, 'issues', 'activeFieldId', 'summary', 'onLocate', 'message', 'class')

  const issues = () => props.issues ?? form?.issues() ?? []
  const message = () => props.message ?? form?.message()
  const remembered = createMemo<string | null>((previous = null) => {
    const active = props.activeFieldId !== undefined ? props.activeFieldId : form?.activeFieldId()
    return active === undefined ? previous : active
  })
  const current = createMemo(() => issues().find((issue) => issue.id === remembered()))
  const text = () =>
    message() ?? current()?.summary ?? (issues().length ? props.summary(issues().length) : '')

  return (
    <div {...rest} class={[styles.root, props.class]} data-form-feedback>
      <Show when={message() || issues().length} fallback={<span role="status" />}>
        <FeedbackPrompt
          text={text()}
          detail={message() === undefined ? current()?.message : undefined}
          onLocate={
            message()
              ? undefined
              : () => (props.onLocate ?? form?.locate)?.(current()?.id ?? issues()[0]!.id)
          }
        />
      </Show>
    </div>
  )
}

function FeedbackPrompt(props: {
  text: string
  detail: string | undefined
  onLocate: (() => void) | undefined
}): JSX.Element {
  const tooltip = createTooltip()
  const id = createUniqueId()
  const [trigger, bindTrigger] = createSignal<HTMLElement>()
  let message!: HTMLSpanElement
  const [clipped, setClipped] = createSignal(false)
  const detail = () => (props.detail === props.text ? undefined : props.detail)

  const measure = () => {
    setClipped(message.scrollWidth > message.clientWidth)
  }

  onSettled(() => {
    const size = new ResizeObserver(measure)
    size.observe(message)
    return () => size.disconnect()
  })

  createEffect(() => props.text, measure)

  const Control = dynamic(() => (props.onLocate ? 'button' : 'span'))
  return (
    <>
      <Control
        ref={bindTrigger}
        type={props.onLocate ? 'button' : undefined}
        tabindex={!props.onLocate && clipped() ? 0 : undefined}
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
      </Control>
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
