import { createEffect, flush } from 'solid-js'
import type { Accessor } from 'solid-js'
import { createValue, onFormReset } from './state'
import { nativeValidityChanged } from './form'

/** Controlled checked state or local reset baseline with change notification. */
export interface CheckedValueProps {
  checked?: boolean | undefined
  defaultChecked?: boolean | undefined
  /** Reports a checked-state request from user interaction or accepted form reset. */
  onCheckedChange?: ((checked: boolean) => void) | undefined
}

/**
 * Binds a native checkbox's checked state and uncancelled resets within the current Solid owner.
 *
 * Returns an event updater that requests the native value and resynchronizes it with the value
 * owner.
 */
export function bindCheckedControl(props: CheckedValueProps, element: Accessor<HTMLInputElement>) {
  const [checked, change] = createValue(
    () => props.checked,
    () => props.defaultChecked ?? false,
    (next) => props.onCheckedChange?.(next),
  )
  const sync = (next = checked()) => {
    const node = element()
    node.checked = next
    nativeValidityChanged(node.form)
  }

  createEffect(
    () => [props.defaultChecked ?? false, checked()],
    ([initial, next]) => {
      element().defaultChecked = initial
      sync(next)
    },
  )

  // A native change callback can synchronously inspect the input after its owner adopts the value.
  function commit(next: boolean) {
    change(next)
    flush()
    sync()
  }

  const flushReset = onFormReset(element, () => commit(props.defaultChecked ?? false))
  return () => {
    const next = element().checked
    flushReset()
    commit(next)
  }
}
