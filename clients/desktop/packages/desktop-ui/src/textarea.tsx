/** @fileoverview Multiline text editing with the same composition and reset rules as Input. */

import { createEffect, splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { bindNativeValue, inputClass } from './form/native'

export interface TextareaProps extends Omit<
  JSX.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'value' | 'children'
> {
  value?: string | undefined
  defaultValue?: string
  onValueChange?: (value: string) => void
}

/** Let the browser own selection, undo and line editing while reporting committed input. */
export function Textarea(props: TextareaProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'class',
    'ref',
    'value',
    'defaultValue',
    'onValueChange',
  ])
  let input!: HTMLTextAreaElement
  createEffect(() => {
    input.defaultValue = local.defaultValue ?? ''
  })
  bindNativeValue(
    () => input,
    () => local.value,
    () => input.value,
    (v) => {
      input.value = v
    },
    (v) => local.onValueChange?.(v),
    'input',
    true,
  )

  return (
    <textarea
      {...rest}
      ref={(el) => {
        input = el
        if (typeof local.ref === 'function') {
          local.ref(el)
        }
      }}
      class={twMerge(inputClass, 'min-h-16 resize-y', local.class)}
    />
  )
}
