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
import { Icon, mdiCalendarOutline } from '../../../internal/icon/glyph'
import { createPresentation } from '../../../internal/popup/presentation'
import { createValue, onFormReset } from '../../../internal/state'
import { InputFrame } from '../frame'
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

  /** Checks whether disabled or readonly state prevents calendar interaction. */
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
  const validate = () =>
    input.setCustomValidity(
      input.validity.badInput || (input.value && !allowed(input.value))
        ? local.invalidDateMessage
        : '',
    )
  /** Synchronizes the editor to the owned value and refreshes custom validity. */
  const sync = () => {
    if (input.value !== value()) {
      input.value = value()
    }
    validate()
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
            setOpen(false)
            enter(date)
            input.focus()
          }}
        />
      </Show>
    </InputFrame>
  )
}
