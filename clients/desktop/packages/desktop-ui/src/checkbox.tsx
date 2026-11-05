/** @fileoverview Native checkable form control shared by checkbox and switch presentations. */

import { createEffect, splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { bindNativeValue } from './form/native'

export interface CheckboxProps extends Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'checked'
> {
  checked?: boolean | undefined
  defaultChecked?: boolean
  indeterminate?: boolean
  onCheckedChange?: (checked: boolean) => void
}

/** Submit the ordinary checkbox value when checked, including inside an external form. */
export function Checkbox(props: CheckboxProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'class',
    'ref',
    'checked',
    'defaultChecked',
    'indeterminate',
    'onCheckedChange',
  ])
  let input!: HTMLInputElement
  createEffect(() => {
    input.defaultChecked = local.defaultChecked ?? false
  })
  function syncIndeterminate(): void {
    input.indeterminate = local.indeterminate ?? false
  }
  createEffect(syncIndeterminate)
  bindNativeValue(
    () => input,
    () => local.checked,
    () => input.checked,
    (v) => {
      input.checked = v
    },
    (checked) => {
      syncIndeterminate()
      local.onCheckedChange?.(checked)
    },
    'change',
  )

  return (
    <input
      {...rest}
      type="checkbox"
      ref={(el) => {
        input = el
        if (typeof local.ref === 'function') {
          local.ref(el)
        }
      }}
      class={twMerge(
        'ks-focus m-0 size-4 shrink-0 accent-primary disabled:opacity-50',
        local.class,
      )}
    />
  )
}
