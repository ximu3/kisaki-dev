/** @fileoverview Calendar month and year choices navigate the view independently of its selected day. */

import { createMemo } from 'solid-js'
import type { JSX } from 'solid-js'
import { createElementRef } from '../../../internal/dom'
import { createSelectionPopup } from '../../selection/popup'
import { createSelection } from '../../selection/collection'
import { SelectionList } from '../../selection/list'
import { SelectionTrigger } from '../../selection/trigger'
import type { SelectionOption } from '../../selection/types'
import styles from './styles.module.css'

/**
 * Inclusive numeric period range, current value and host-owned formatting and navigation callbacks.
 */
interface PeriodProps {
  label: string
  value: number
  first: number
  last: number
  /** Formats a month or year value for its option label. */
  format: (value: number) => string
  /** Requests navigation to the selected month or year. */
  choose: (value: number) => void
}

/** Renders a virtualized period selector, including ranges spanning all 9,999 supported years. */
export function PeriodSelect(props: PeriodProps): JSX.Element {
  const popup = createSelectionPopup()
  /** Presence and visibility controls inherited from this period selector's popup owner. */
  const { present, setOpen } = popup
  const [trigger, bindTrigger] = createElementRef<HTMLButtonElement>()

  /** Visible formatted period choices derived from the current bounds. */
  const options = createMemo(() =>
    present()
      ? Array.from({ length: props.last - props.first + 1 }, (_, index) => {
          const value = props.first + index
          return { value: String(value), label: props.format(value) }
        })
      : [],
  )
  const collection = createSelection(options)

  /** Closes the period popup and forwards the selected numeric month or year. */
  const choose = (option: SelectionOption) => {
    setOpen(false)
    props.choose(Number(option.value))
  }

  return (
    <>
      <SelectionTrigger
        ref={bindTrigger}
        aria-label={props.label}
        popup={popup}
        collection={collection}
        selected={[String(props.value)]}
        onBlur={() => setOpen(false)}
        onChoose={choose}
      >
        {props.format(props.value)}
      </SelectionTrigger>
      <SelectionList
        popup={popup}
        label={props.label}
        listClass={styles.periodList}
        anchor={trigger}
        collection={collection}
        selected={[String(props.value)]}
        onChoose={choose}
        virtual
      />
    </>
  )
}
