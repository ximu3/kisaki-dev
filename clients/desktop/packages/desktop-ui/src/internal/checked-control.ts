/** @fileoverview Native checked-state ownership shared by checkbox and switch. */

import { createEffect, onMount, untrack } from 'solid-js'
import type { Accessor } from 'solid-js'
import { createValue, onFormReset } from './state'

/** Controlled checked state or a native reset baseline, with a callback for user changes and reset. */
export interface CheckedValueProps {
  checked?: boolean | undefined
  defaultChecked?: boolean | undefined
  onCheckedChange?: ((checked: boolean) => void) | undefined
}

/** Connect a native checkbox and follow resets without consuming canceled reset events. */
export function bindCheckedControl(props: CheckedValueProps, element: Accessor<HTMLInputElement>) {
  const [checked, change] = createValue(
    () => props.checked,
    () => props.defaultChecked ?? false,
    (next) => props.onCheckedChange?.(next),
  )
  const sync = () => {
    element().checked = checked()
  }

  onMount(() => {
    createEffect(() => {
      element().defaultChecked = props.defaultChecked ?? false
      untrack(sync)
    })
    createEffect(sync)
  })
  onFormReset(element, () => {
    change(props.defaultChecked ?? false)
    sync()
  })

  return () => {
    change(element().checked)
    untrack(sync)
  }
}
