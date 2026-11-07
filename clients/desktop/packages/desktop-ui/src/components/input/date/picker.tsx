/** @fileoverview Calendar navigation owns the viewed period and focus until the caller accepts a day. */

import { createEffect, createMemo, createSignal, For, onMount, Show } from 'solid-js'
import type { JSX } from 'solid-js'
import { classes } from '../../../internal/dom'
import { Icon, mdiChevronLeft, mdiChevronRight } from '../../../internal/icon/icon'
import { createPopup } from '../../../internal/popup/controller'
import surface from '../../../internal/popup/surface.module.css'
import { addDays, addMonths, calendarDays, parseDate, todayValue } from './calendar'
import { PeriodSelect } from './period'
import styles from './styles.module.css'

/** Calendar navigation labels come from the document owner. */
export interface CalendarProps {
  min?: string | undefined
  max?: string | undefined
  locale?: string | undefined
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | undefined

  calendarLabel: string
  monthLabel: string
  yearLabel: string
  previousMonthLabel: string
  nextMonthLabel: string
}

interface PickerProps extends CalendarProps {
  id: string
  anchor: () => HTMLButtonElement
  value: string
  allowed: (date: string) => boolean
  choose: (date: string) => void
  close: () => void
}

/** Opening initializes the browsing period and moves focus to the current day choice. */
export function DatePicker(props: PickerProps): JSX.Element {
  let calendar!: HTMLDivElement
  const clamp = (date: string) => {
    if (date < (props.min ?? '0001-01-01')) {
      date = props.min ?? '0001-01-01'
    }
    if (date > (props.max ?? '9999-12-31')) {
      return props.max ?? '9999-12-31'
    }
    return date
  }
  const formats = createMemo(() => ({
    month: new Intl.DateTimeFormat(props.locale, {
      calendar: 'gregory',
      year: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }),
    monthName: new Intl.DateTimeFormat(props.locale, {
      calendar: 'gregory',
      month: 'long',
      timeZone: 'UTC',
    }),
    year: new Intl.NumberFormat(props.locale, { useGrouping: false }),
    day: new Intl.DateTimeFormat(props.locale, {
      calendar: 'gregory',
      dateStyle: 'full',
      timeZone: 'UTC',
    }),
    weekday: new Intl.DateTimeFormat(props.locale, { weekday: 'long', timeZone: 'UTC' }),
    shortWeekday: new Intl.DateTimeFormat(props.locale, { weekday: 'short', timeZone: 'UTC' }),
  }))
  const initial = clamp(parseDate(props.value) ? props.value : todayValue())
  const [active, setActive] = createSignal(initial)
  const [month, setMonth] = createSignal(`${initial.slice(0, 7)}-01`)
  const viewYear = () => Number(month().slice(0, 4))
  const viewMonth = () => Number(month().slice(5, 7))
  const minYear = () => Number(props.min?.slice(0, 4) ?? 1)
  const maxYear = () => Number(props.max?.slice(0, 4) ?? 9999)
  const periodOrder = createMemo(() =>
    formats()
      .month.formatToParts(parseDate(month()))
      .map((part) => part.type)
      .filter((type) => type === 'year' || type === 'month'),
  )
  const days = createMemo(() => calendarDays(month(), props.weekStartsOn ?? 1))
  const weekdays = () =>
    Array.from({ length: 7 }, (_, index) =>
      addDays('2023-01-01', (props.weekStartsOn ?? 1) + index),
    )

  const browse = (date: string) => {
    const next = clamp(date)
    setActive(next)
    setMonth(`${next.slice(0, 7)}-01`)
  }
  const focusDay = (date: string) => {
    browse(date)
    queueMicrotask(() =>
      calendar.querySelector<HTMLButtonElement>(`[data-date="${active()}"]`)?.focus(),
    )
  }
  createPopup({
    element: () => calendar,
    anchor: props.anchor,
    open: () => true,
    change: (open) => {
      if (!open) {
        props.close()
      }
    },
    placement: () => 'bottom-end',
  })
  onMount(() => {
    createEffect(() => {
      const next = clamp(active())
      if (next !== active()) {
        browse(next)
      }
    })
    queueMicrotask(() =>
      calendar.querySelector<HTMLButtonElement>(`[data-date="${active()}"]`)?.focus(),
    )
  })

  return (
    <div
      ref={(node) => {
        calendar = node
      }}
      id={props.id}
      popover="auto"
      role="dialog"
      aria-label={props.calendarLabel}
      class={classes(surface.surface, styles.calendar)}
      onFocusOut={(event) => {
        if (
          event.relatedTarget &&
          !calendar.contains(event.relatedTarget as Node | null) &&
          event.relatedTarget !== props.anchor()
        ) {
          props.close()
        }
      }}
    >
      <div class={styles.heading}>
        <button
          type="button"
          aria-label={props.previousMonthLabel}
          disabled={month().slice(0, 7) <= (props.min ?? '0001-01-01').slice(0, 7)}
          onClick={() => browse(addMonths(month(), -1))}
        >
          <Icon path={mdiChevronLeft} />
        </button>
        <div class={styles.periods}>
          <For each={periodOrder()}>
            {(part) =>
              part === 'month' ? (
                <PeriodSelect
                  label={props.monthLabel}
                  value={viewMonth()}
                  first={viewYear() === minYear() ? Number(props.min?.slice(5, 7) ?? 1) : 1}
                  last={viewYear() === maxYear() ? Number(props.max?.slice(5, 7) ?? 12) : 12}
                  format={(value) =>
                    formats().monthName.format(
                      parseDate(`2000-${String(value).padStart(2, '0')}-01`),
                    )
                  }
                  choose={(value) => browse(addMonths(month(), value - viewMonth()))}
                />
              ) : (
                <PeriodSelect
                  label={props.yearLabel}
                  value={viewYear()}
                  first={minYear()}
                  last={maxYear()}
                  format={(value) => formats().year.format(value)}
                  choose={(value) => browse(addMonths(month(), (value - viewYear()) * 12))}
                />
              )
            }
          </For>
        </div>
        <button
          type="button"
          aria-label={props.nextMonthLabel}
          disabled={month().slice(0, 7) >= (props.max ?? '9999-12-31').slice(0, 7)}
          onClick={() => browse(addMonths(month(), 1))}
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
          const weekday = (parseDate(active())!.getUTCDay() - (props.weekStartsOn ?? 1) + 7) % 7
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
                        aria-selected={props.value === date}
                        aria-current={date === todayValue() ? 'date' : undefined}
                        aria-disabled={!props.allowed(date)}
                        tabIndex={active() === date ? 0 : -1}
                        class={classes(
                          styles.day,
                          date.slice(0, 7) !== month().slice(0, 7) ? styles.outside : undefined,
                        )}
                        onFocus={() => setActive(date)}
                        onClick={() => {
                          if (props.allowed(date)) {
                            props.choose(date)
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
  )
}
