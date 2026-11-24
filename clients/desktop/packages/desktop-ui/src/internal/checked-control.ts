import { createEffect, type Accessor } from 'solid-js'
import { commitNativeValue, createValue, onFormReset } from './state'
import { nativeValidityChanged } from './form'

export interface CheckedValueProps {
  checked?: boolean | undefined
  defaultChecked?: boolean | undefined
  onCheckedChange?: ((checked: boolean) => void) | undefined
}

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

  const commit = commitNativeValue(change, sync)

  const flushReset = onFormReset(element, () => commit(props.defaultChecked ?? false))
  return () => {
    const next = element().checked
    flushReset()
    commit(next)
  }
}
