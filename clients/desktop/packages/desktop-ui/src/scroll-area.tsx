/** @fileoverview Provide a keyboard-focusable native scrolling viewport. */

import { splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Provide a keyboard-focusable native scrolling viewport. */
export function ScrollArea(props: JSX.IntrinsicElements['div']): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <div
      tabIndex={0}
      {...rest}
      class={twMerge('ks-focus min-h-0 min-w-0 overflow-auto overscroll-contain', local.class)}
    />
  )
}
