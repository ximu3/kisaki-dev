/** @fileoverview Typed ISO dates and a themed calendar share one value and validity boundary. */

import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  onMount,
  Show,
  splitProps,
} from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, callHandler, classes } from '../../../internal/dom'
import { fieldAttributes, closeWhenUnavailable } from '../../../internal/field'
import { Icon, mdiCalendarOutline, mdiChevronLeft, mdiChevronRight } from '../../../internal/icons'
import { createPopup } from '../../../internal/popup'
import { createValue, onFormReset } from '../../../internal/state'
import { NativeInput } from '../native'
import type { InputProps } from '../control'
import { addDays, addMonths, calendarDays, isDateAllowed, parseDate, todayValue } from './calendar'
import styles from './styles.module.css'

/** Valid values are complete YYYY-MM-DD dates. Text drafts stay visible and participate in validity. */
export interface DateInputProps extends Omit<InputProps, 'type' | 'min' | 'max' | 'step'> {
  min?: string
  max?: string
  step?: number
  locale?: string
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6

  calendarLabel: string
  previousMonthLabel: string
  nextMonthLabel: string
  invalidDateMessage: string
}

export function DateInput(props: DateInputProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'value',
    'defaultValue',
    'onValueChange',
    'min',
    'max',
    'step',
    'locale',
    'weekStartsOn',
    'calendarLabel',
    'previousMonthLabel',
    'nextMonthLabel',
    'invalidDateMessage',
    'ref',
    'onKeyDown',
  ])
  const field = fieldAttributes()
  const [value, change] = createValue(
    () => local.value,
    () => local.defaultValue ?? '',
    (next) => local.onValueChange?.(next),
  )
  const [open, setOpen] = createSignal(false)
  const [active, setActive] = createSignal(todayValue())
  const [month, setMonth] = createSignal(todayValue())
  const id = createUniqueId()
  let input!: HTMLInputElement
  let trigger!: HTMLButtonElement
  let calendar!: HTMLDivElement

  const allowed = (date: string) =>
    isDateAllowed(date, local.min, local.max, local.step ?? 1, local.defaultValue)
  const clamp = (date: string) => {
    if (date < (local.min ?? '0001-01-01')) {
      return local.min ?? '0001-01-01'
    }
    if (date > (local.max ?? '9999-12-31')) {
      return local.max ?? '9999-12-31'
    }
    return date
  }
  const formats = createMemo(() => ({
    month: new Intl.DateTimeFormat(local.locale, {
      year: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }),
    day: new Intl.DateTimeFormat(local.locale, { dateStyle: 'full', timeZone: 'UTC' }),
    weekday: new Intl.DateTimeFormat(local.locale, { weekday: 'long', timeZone: 'UTC' }),
    shortWeekday: new Intl.DateTimeFormat(local.locale, { weekday: 'short', timeZone: 'UTC' }),
  }))
  const days = createMemo(() => calendarDays(month(), local.weekStartsOn ?? 1))
  const weekdays = () =>
    Array.from({ length: 7 }, (_, index) =>
      addDays('2023-01-01', (local.weekStartsOn ?? 1) + index),
    )
  const blocked = () => (props.disabled ?? field.disabled) || props.readOnly
  const show = () => {
    const date = clamp(parseDate(value()) ? value() : todayValue())
    setActive(date)
    setMonth(`${date.slice(0, 7)}-01`)
    setOpen(true)
  }
  const focusDay = (date: string) => {
    date = clamp(date)
    setActive(date)
    setMonth(`${date.slice(0, 7)}-01`)
    queueMicrotask(() =>
      calendar.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)?.focus(),
    )
  }
  const choose = (date: string) => {
    change(date)
    setOpen(false)
    input.focus()
  }

  createPopup({
    element: () => calendar,
    anchor: () => trigger,
    open,
    change: setOpen,
    placement: () => 'bottom-end',
  })
  closeWhenUnavailable(
    () => input,
    () => setOpen(false),
  )
  onFormReset(
    () => input,
    () => setOpen(false),
  )
  onMount(() => {
    createEffect(() =>
      input.setCustomValidity(value() && !allowed(value()) ? local.invalidDateMessage : ''),
    )
    createEffect(() => {
      if (open()) {
        queueMicrotask(() => {
          if (open()) {
            calendar.querySelector<HTMLButtonElement>(`[data-date="${active()}"]`)?.focus()
          }
        })
      }
    })
  })

  return (
    <div class={styles.container}>
      <NativeInput
        {...rest}
        type="text"
        inputmode="numeric"
        placeholder={props.placeholder ?? 'YYYY-MM-DD'}
        value={value()}
        defaultValue={local.defaultValue}
        onValueChange={change}
        ref={(node) => {
          input = node
          assignRef(local.ref, node)
        }}
        onKeyDown={(event) => {
          callHandler(local.onKeyDown, event)
          if (!event.defaultPrevented && event.altKey && event.key === 'ArrowDown' && !blocked()) {
            event.preventDefault()
            show()
          }
        }}
      />
      <button
        ref={(node) => {
          trigger = node
        }}
        type="button"
        aria-label={local.calendarLabel}
        aria-haspopup="dialog"
        aria-expanded={open()}
        aria-controls={id}
        class={styles.trigger}
        disabled={blocked()}
        onClick={() => (open() ? setOpen(false) : show())}
      >
        <Icon path={mdiCalendarOutline} />
      </button>
      <div
        ref={(node) => {
          calendar = node
        }}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={local.calendarLabel}
        class={styles.calendar}
        onFocusOut={(event) => {
          if (
            event.relatedTarget &&
            !calendar.contains(event.relatedTarget as Node | null) &&
            event.relatedTarget !== trigger
          ) {
            setOpen(false)
          }
        }}
      >
        <div class={styles.heading}>
          <button
            type="button"
            aria-label={local.previousMonthLabel}
            disabled={month().slice(0, 7) <= (local.min ?? '0001-01-01').slice(0, 7)}
            onClick={() => {
              setMonth(addMonths(month(), -1))
              setActive(clamp(month()))
            }}
          >
            <Icon path={mdiChevronLeft} />
          </button>
          <span aria-live="polite">{formats().month.format(parseDate(month()))}</span>
          <button
            type="button"
            aria-label={local.nextMonthLabel}
            disabled={month().slice(0, 7) >= (local.max ?? '9999-12-31').slice(0, 7)}
            onClick={() => {
              setMonth(addMonths(month(), 1))
              setActive(clamp(month()))
            }}
          >
            <Icon path={mdiChevronRight} />
          </button>
        </div>
        <div
          role="grid"
          aria-label={formats().month.format(parseDate(month()))}
          onKeyDown={(event) => {
            let date: string | undefined
            if (event.key === 'ArrowLeft') {
              date = addDays(active(), -1)
            }
            if (event.key === 'ArrowRight') {
              date = addDays(active(), 1)
            }
            if (event.key === 'ArrowUp') {
              date = addDays(active(), -7)
            }
            if (event.key === 'ArrowDown') {
              date = addDays(active(), 7)
            }
            if (event.key === 'PageUp') {
              date = addMonths(active(), event.shiftKey ? -12 : -1)
            }
            if (event.key === 'PageDown') {
              date = addMonths(active(), event.shiftKey ? 12 : 1)
            }
            const weekday = (parseDate(active())!.getUTCDay() - (local.weekStartsOn ?? 1) + 7) % 7
            if (event.key === 'Home') {
              date = addDays(active(), -weekday)
            }
            if (event.key === 'End') {
              date = addDays(active(), 6 - weekday)
            }
            if (date) {
              event.preventDefault()
              event.stopPropagation()
              focusDay(date)
            }
          }}
        >
          <div role="row" class={styles.week}>
            <For each={weekdays()}>
              {(date) => (
                <span role="columnheader" aria-label={formats().weekday.format(parseDate(date))}>
                  {formats().shortWeekday.format(parseDate(date))}
                </span>
              )}
            </For>
          </div>
          <For each={days()}>
            {(week) => (
              <div role="row" class={styles.week}>
                <For each={week}>
                  {(date) => (
                    <Show when={date} keyed fallback={<span role="gridcell" />}>
                      {(date) => (
                        <button
                          type="button"
                          role="gridcell"
                          data-date={date}
                          aria-label={formats().day.format(parseDate(date))}
                          aria-selected={value() === date}
                          aria-current={date === todayValue() ? 'date' : undefined}
                          aria-disabled={!allowed(date)}
                          tabIndex={active() === date ? 0 : -1}
                          class={classes(
                            styles.day,
                            date.slice(0, 7) !== month().slice(0, 7) ? styles.outside : undefined,
                          )}
                          onFocus={() => setActive(date)}
                          onClick={() => {
                            if (allowed(date)) {
                              choose(date)
                            }
                          }}
                        >
                          {Number(date.slice(8))}
                        </button>
                      )}
                    </Show>
                  )}
                </For>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}
