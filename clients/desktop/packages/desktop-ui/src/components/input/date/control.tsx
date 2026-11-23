/** @fileoverview Native date segments and a themed calendar share one form control and ISO value. */

import { createEffect, createMemo, createSignal, createUniqueId, flush, Show, omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { callHandler } from '../../../internal/dom'
import { closeWhenUnavailable, fieldAttributes } from '../../../internal/field'
import { Icon, Calendar } from '../../../internal/icon/glyph'
import { createPresentation } from '../../../internal/popup/presentation'
import { createValue, onFormReset } from '../../../internal/state'
import { InputFrame } from '../frame'
import { nativeValidityChanged } from '../../../internal/form'
import frame from '../styles.module.css'
import type { InputProps } from '../control'
import { parseDate } from './calendar'
import { DatePicker } from './picker'
import type { CalendarProps } from './picker'
import styles from './styles.module.css'

/**
 * Native date-editor and calendar props with localized validation feedback.
 *
 * Complete ISO dates and empty values cross the value boundary; incomplete segments remain native
 * drafts.
 */
export interface DateInputProps
  extends Omit<InputProps, 'type' | 'min' | 'max' | 'step'>, CalendarProps {
  step?: number
  invalidDateMessage: string
}

/**
 * Connects native date segments and a themed calendar to one form value.
 *
 * The ref targets the editor. Browsing months or years leaves the value unchanged until a day is
 * chosen.
 */
export function DateInput(props: DateInputProps): JSX.Element {
  const rest = omit(
    props,
    'value',
    'defaultValue',
    'onValueChange',
    'invalidDateMessage',
    'step',
    'size',
    'htmlSize',
    'ref',
    'class',
    'style',
    'onInput',
    'onKeyDown',
    'onPaste',
    'min',
    'max',
    'locale',
    'weekStartsOn',
    'calendarLabel',
    'monthLabel',
    'yearLabel',
    'previousMonthLabel',
    'nextMonthLabel',
  )
  const field = fieldAttributes(props)
  /** Live native date text and change requests delegated to its value owner. */
  const [value, change] = createValue(
    () => props.value,
    () => props.defaultValue ?? '',
    (next) => props.onValueChange?.(next),
  )
  /** Locally owned visibility of the calendar picker. */
  const [open, setOpen] = createSignal(false)
  const [trigger, bindTrigger] = createSignal<HTMLButtonElement>()
  const id = createUniqueId()
  let input!: HTMLInputElement
  let picker: HTMLDivElement | undefined
  /** Presence reader retaining the calendar during its exit transition. */
  const present = createPresentation(open, () => picker)

  /** Checks whether disabled or readonly state prevents calendar interaction. */
  const blocked = () => (props.disabled ?? field.disabled) || props.readonly
  /** Valid current minimum date text, absent when the supplied bound cannot be parsed. */
  const min = createMemo(() => (parseDate(props.min ?? '') ? props.min : undefined))
  /** Valid current maximum date text with the native calendar's supported upper fallback. */
  const max = createMemo(() => (parseDate(props.max ?? '') ? props.max! : '9999-12-31'))

  // Ask the same native date constraint implementation about a day without disturbing the edited segments.
  /** Detached native date input reflecting the current bounds and step for validity checks. */
  const constraints = createMemo(() => {
    const candidate = document.createElement('input')
    candidate.type = 'date'
    candidate.min = min() ?? ''
    candidate.max = max()
    candidate.defaultValue = props.defaultValue ?? ''
    if (props.step !== undefined) {
      candidate.step = String(props.step)
    }
    return candidate
  })
  /** Checks a candidate day with the same native bounds and step constraints as the editor. */
  const allowed = (date: string) => {
    const candidate = constraints()
    candidate.value = date
    return candidate.value !== '' && candidate.validity.valid
  }
  /**
   * Updates localized custom validity for incomplete segments or a constraint-violating complete
   * date.
   */
  const validate = (candidate = constraints(), message = props.invalidDateMessage) => {
    candidate.value = input.value
    input.setCustomValidity(
      input.validity.badInput || (input.value && !candidate.validity.valid) ? message : '',
    )
  }
  /** Restores the owned value after editing and updates native form validity. */
  const sync = (next = value(), candidate = constraints(), message = props.invalidDateMessage) => {
    if (input.value !== next) {
      input.value = next
    }
    validate(candidate, message)
    nativeValidityChanged(input.form)
  }

  /** Settles the value owner before a native callback reads or submits the date. */
  function commit(next: string) {
    change(next)
    flush()
    sync()
  }

  /**
   * Writes a chosen date through the editor and dispatches its ordinary input and change events.
   */
  const enter = (date: string) => {
    input.value = date
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }

  closeWhenUnavailable(
    () => input,
    () => setOpen(false),
  )
  const flushReset = onFormReset(
    () => input,
    () => {
      commit(props.defaultValue ?? '')
      setOpen(false)
    },
  )
  createEffect(
    () => [value(), props.defaultValue ?? '', constraints(), props.invalidDateMessage],
    ([next, initial, candidate, message]) => {
      input.defaultValue = initial
      sync(next, candidate, message)
    },
  )

  return (
    <InputFrame class={props.class} style={props.style} size={props.size} open={open()}>
      <input
        {...field}
        {...rest}
        type="date"
        size={props.htmlSize}
        lang={props.locale ?? props.lang}
        min={min()}
        max={max()}
        step={props.step}
        ref={[
          (node) => {
            input = node
          },
          props.ref,
        ]}
        class={[frame.editor, styles.editor]}
        onInput={(event) => {
          if (!input.validity.badInput && (!input.value || parseDate(input.value))) {
            const next = input.value
            flushReset()
            commit(next)
          } else {
            validate()
          }
          callHandler(props.onInput, event)
        }}
        onPaste={(event) => {
          callHandler(props.onPaste, event)
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
          callHandler(props.onKeyDown, event)
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
        class={[frame.end, styles.trigger]}
        ref={bindTrigger}
        aria-label={props.calendarLabel}
        popovertarget={id}
        aria-haspopup="dialog"
        aria-expanded={open() ? 'true' : 'false'}
        aria-controls={open() ? id : undefined}
        disabled={blocked()}
        onClick={(event) => {
          event.preventDefault()
          setOpen(!open())
        }}
      >
        <Icon icon={Calendar} />
      </button>
      <Show when={present()}>
        <DatePicker
          locale={props.locale}
          weekStartsOn={props.weekStartsOn}
          calendarLabel={props.calendarLabel}
          monthLabel={props.monthLabel}
          yearLabel={props.yearLabel}
          previousMonthLabel={props.previousMonthLabel}
          nextMonthLabel={props.nextMonthLabel}
          open={open()}
          panelRef={(node) => {
            picker = node
          }}
          min={min()}
          max={max()}
          id={id}
          anchor={trigger}
          value={value()}
          allowed={allowed}
          close={() => setOpen(false)}
          choose={(date) => {
            setOpen(false)
            enter(date)
            input.focus()
          }}
        />
      </Show>
    </InputFrame>
  )
}
