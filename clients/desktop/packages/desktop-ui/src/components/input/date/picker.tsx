/** @fileoverview Calendar navigation owns the viewed period and focus until the caller accepts a day. */

import { createEffect, createMemo, createSignal, For, on, onMount, Show } from 'solid-js'
import type { JSX } from 'solid-js'
import { classes } from '../../../internal/dom'
import { Icon, ChevronLeft, ChevronRight } from '../../../internal/icon/glyph'
import { createPopup } from '../../../internal/popup/controller'
import { displayedWhileOpen } from '../../../internal/popup/presentation'
import frame from '../../../internal/popup/surface.module.css'
import { addDays, addMonths, calendarDays, parseDate, todayValue } from './calendar'
import { PeriodSelect } from './period'
import styles from './styles.module.css'

/** Calendar bounds, locale and navigation labels supplied by the document owner. */
export interface CalendarProps {
  min?: string | undefined
  max?: string | undefined
  locale?: string | undefined
  /** First weekday: 0 is Sunday and 1 is Monday; omission uses Monday. */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | undefined

  calendarLabel: string
  monthLabel: string
  yearLabel: string
  previousMonthLabel: string
  nextMonthLabel: string
}

/** Calendar popup state and host connections for anchoring, validation, selection and closing. */
interface PickerProps extends CalendarProps {
  open: boolean
  /** Publishes the mounted popup element to its presentation owner. */
  panelRef: (node: HTMLDivElement) => void
  id: string
  /** Returns the button used to position and return focus from the calendar. */
  anchor: () => HTMLButtonElement
  value: string
  /** Checks whether a day satisfies the owning editor's native constraints. */
  allowed: (date: string) => boolean
  /** Submits an allowed day to the owning date editor. */
  choose: (date: string) => void
  /** Requests closing the calendar without choosing a day. */
  close: () => void
}

/**
 * Renders calendar browsing and keyboard navigation independently of committed selection.
 *
 * Opening initializes the visible period and focuses the current day choice.
 */
export function DatePicker(props: PickerProps): JSX.Element {
  let calendar!: HTMLDivElement
  /** Applies the configured lower and upper browsing bounds to an ISO date. */
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

  const selected = displayedWhileOpen(
    () => props.open,
    () => props.value,
  )
  const initial = clamp(parseDate(props.value) ? props.value : todayValue())
  const [active, setActive] = createSignal(initial)
  const [month, setMonth] = createSignal(`${initial.slice(0, 7)}-01`)
  /** Returns the year represented by the current displayed month. */
  const viewYear = () => Number(month().slice(0, 4))
  /** Returns the one-based month used by period navigation. */
  const viewMonth = () => Number(month().slice(5, 7))
  /** Returns the first year offered by the year selector. */
  const minYear = () => Number(props.min?.slice(0, 4) ?? 1)
  /** Returns the last year offered by the year selector. */
  const maxYear = () => Number(props.max?.slice(0, 4) ?? 9999)
  const periodOrder = createMemo(() =>
    formats()
      .month.formatToParts(parseDate(month()))
      .map((part) => part.type)
      .filter((type) => type === 'year' || type === 'month'),
  )
  const days = createMemo(() => calendarDays(month(), props.weekStartsOn ?? 1))
  /** Builds reference dates in week-start order for localized weekday headers. */
  const weekdays = () =>
    Array.from({ length: 7 }, (_, index) =>
      addDays('2023-01-01', (props.weekStartsOn ?? 1) + index),
    )

  /**
   * Updates the active day and displayed month within browsing bounds without committing a value.
   */
  const browse = (date: string) => {
    const next = clamp(date)
    setActive(next)
    setMonth(`${next.slice(0, 7)}-01`)
  }
  /** Browses to a bounded day and focuses its cell after the view updates. */
  const focusDay = (date: string) => {
    browse(date)
    queueMicrotask(() =>
      calendar.querySelector<HTMLButtonElement>(`[data-date="${active()}"]`)?.focus(),
    )
  }
  createPopup({
    element: () => calendar,
    anchor: props.anchor,
    open: () => props.open,
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
    createEffect(
      on(
        () => props.open,
        (opening) => {
          if (!opening) {
            return
          }
          browse(parseDate(props.value) ? props.value : todayValue())
          queueMicrotask(() => {
            if (props.open) {
              calendar.querySelector<HTMLButtonElement>(`[data-date="${active()}"]`)?.focus()
            }
          })
        },
      ),
    )
  })

  return (
    <div
      ref={(node) => {
        calendar = node
        props.panelRef(node)
      }}
      id={props.id}
      popover="auto"
      role="dialog"
      aria-label={props.calendarLabel}
      class={classes(frame.anchor, styles.calendar)}
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
      <div class={classes(frame.viewport, styles.content)}>
        <div class={styles.heading}>
          <button
            type="button"
            aria-label={props.previousMonthLabel}
            disabled={month().slice(0, 7) <= (props.min ?? '0001-01-01').slice(0, 7)}
            onClick={() => browse(addMonths(month(), -1))}
          >
            <Icon icon={ChevronLeft} />
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
            <Icon icon={ChevronRight} />
          </button>
        </div>
        <div
          role="grid"
          class={styles.grid}
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
                          data-option-highlight="hover"
                          data-date={date}
                          aria-label={formats().day.format(parseDate(date))}
                          aria-selected={selected() === date}
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
    </div>
  )
}
