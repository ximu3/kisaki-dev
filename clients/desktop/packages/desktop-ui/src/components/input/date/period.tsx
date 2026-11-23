import { createMemo, createSignal } from 'solid-js'
import type { JSX } from '@solidjs/web'
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
  format: (value: number) => string
  choose: (value: number) => void
}

/** Renders a virtualized period selector, including ranges spanning all 9,999 supported years. */
export function PeriodSelect(props: PeriodProps): JSX.Element {
  const popup = createSelectionPopup()
  const { present, setOpen } = popup
  const [trigger, bindTrigger] = createSignal<HTMLButtonElement>()

  const options = createMemo(() =>
    present()
      ? Array.from({ length: props.last - props.first + 1 }, (_, index) => {
          const value = props.first + index
          return { value: String(value), label: props.format(value) }
        })
      : [],
  )
  const collection = createSelection(options)

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
