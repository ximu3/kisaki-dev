/** @fileoverview Native date segments and a themed calendar share one form control and ISO value. */

import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  onMount,
  Show,
  splitProps,
  untrack,
} from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, callHandler, classes } from '../../../internal/dom'
import { closeWhenUnavailable, fieldAttributes } from '../../../internal/field'
import { Icon, mdiCalendarOutline } from '../../../internal/icon/icon'
import { createValue, onFormReset } from '../../../internal/state'
import { InputFrame } from '../frame'
import frame from '../styles.module.css'
import type { InputProps } from '../control'
import { parseDate } from './calendar'
import { DatePicker } from './picker'
import { createPresentation } from '../../../internal/popup/presentation'
import type { CalendarProps } from './picker'
import styles from './styles.module.css'

/** Complete ISO dates and the empty value cross the editing boundary. Incomplete segments remain native drafts. */
export interface DateInputProps
  extends Omit<InputProps, 'type' | 'min' | 'max' | 'step'>, CalendarProps {
  step?: number
  invalidDateMessage: string
}

/** The ref targets the native editor. Browsing the calendar changes the value only when a day is chosen. */
export function DateInput(props: DateInputProps): JSX.Element {
  const [local, calendar, rest] = splitProps(
    props,
    [
      'value',
      'defaultValue',
      'onValueChange',
      'invalidDateMessage',
      'step',
      'ref',
      'class',
      'style',
      'onInput',
      'onKeyDown',
      'onPaste',
    ],
    [
      'min',
      'max',
      'locale',
      'weekStartsOn',
      'calendarLabel',
      'monthLabel',
      'yearLabel',
      'previousMonthLabel',
      'nextMonthLabel',
    ],
  )
  const field = fieldAttributes(props)
  const [value, change] = createValue(
    () => local.value,
    () => local.defaultValue ?? '',
    (next) => local.onValueChange?.(next),
  )
  const [open, setOpen] = createSignal(false)
  const id = createUniqueId()
  let input!: HTMLInputElement
  let trigger!: HTMLButtonElement
  let picker: HTMLDivElement | undefined
  const present = createPresentation(open, () => picker)

  const blocked = () => (props.disabled ?? field.disabled) || props.readOnly
  const min = createMemo(() => (parseDate(calendar.min ?? '') ? calendar.min : undefined))
  const max = createMemo(() => (parseDate(calendar.max ?? '') ? calendar.max! : '9999-12-31'))

  // Ask the same native date constraint implementation about a day without disturbing the edited segments.
  const constraints = createMemo(() => {
    const candidate = document.createElement('input')
    candidate.type = 'date'
    candidate.min = min() ?? ''
    candidate.max = max()
    candidate.defaultValue = local.defaultValue ?? ''
    if (local.step !== undefined) {
      candidate.step = String(local.step)
    }
    return candidate
  })
  const allowed = (date: string) => {
    const candidate = constraints()
    candidate.value = date
    return candidate.value !== '' && candidate.validity.valid
  }
  const validate = () =>
    input.setCustomValidity(
      input.validity.badInput || (input.value && !allowed(input.value))
        ? local.invalidDateMessage
        : '',
    )
  const sync = () => {
    if (input.value !== value()) {
      input.value = value()
    }
    validate()
  }
  const enter = (date: string) => {
    input.value = date
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }

  closeWhenUnavailable(
    () => input,
    () => setOpen(false),
  )
  onFormReset(
    () => input,
    () => {
      change(local.defaultValue ?? '')
      sync()
      setOpen(false)
    },
  )
  onMount(() => {
    createEffect(() => {
      input.defaultValue = local.defaultValue ?? ''
      untrack(sync)
    })
    createEffect(sync)
  })

  return (
    <InputFrame class={local.class} style={local.style} open={open()}>
      <input
        {...field}
        {...rest}
        type="date"
        lang={calendar.locale ?? props.lang}
        min={min()}
        max={max()}
        step={local.step}
        ref={(node) => {
          input = node
          assignRef(local.ref, node)
        }}
        class={classes(frame.editor, styles.editor)}
        onInput={(event) => {
          if (!input.validity.badInput && (!input.value || parseDate(input.value))) {
            change(input.value)
            sync()
          } else {
            validate()
          }
          callHandler(local.onInput, event)
        }}
        onPaste={(event) => {
          callHandler(local.onPaste, event)
          if (event.defaultPrevented || blocked() || !event.clipboardData) {
            return
          }
          const date = event.clipboardData.getData('text/plain').trim()
          event.preventDefault()
          if (parseDate(date)) {
            enter(date)
          }
        }}
        onKeyDown={(event) => {
          callHandler(local.onKeyDown, event)
          if (
            !event.defaultPrevented &&
            !blocked() &&
            (event.key === 'F4' || (event.altKey && event.key === 'ArrowDown'))
          ) {
            event.preventDefault()
            setOpen(true)
          }
        }}
      />
      <button
        type="button"
        class={classes(frame.end, styles.trigger)}
        ref={(node) => {
          trigger = node
        }}
        aria-label={calendar.calendarLabel}
        popovertarget={id}
        aria-haspopup="dialog"
        aria-expanded={open()}
        aria-controls={open() ? id : undefined}
        disabled={blocked()}
        onClick={(event) => {
          event.preventDefault()
          setOpen(!open())
        }}
      >
        <Icon path={mdiCalendarOutline} />
      </button>
      <Show when={present()}>
        <DatePicker
          {...calendar}
          open={open()}
          panelRef={(node) => {
            picker = node
          }}
          min={min()}
          max={max()}
          id={id}
          anchor={() => trigger}
          value={value()}
          allowed={allowed}
          close={() => setOpen(false)}
          choose={(date) => {
            enter(date)
            setOpen(false)
            input.focus()
          }}
        />
      </Show>
    </InputFrame>
  )
}
