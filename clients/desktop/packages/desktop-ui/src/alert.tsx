/** @fileoverview Announce a message and its actions in place. */

import { splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Announce a message and its actions in place. */
export function Alert(props: JSX.IntrinsicElements['div']): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <div
      role="alert"
      {...rest}
      class={twMerge(
        'ks-box rounded-md border border-border bg-surface p-3 text-sm text-surface-foreground',
        local.class,
      )}
    />
  )
}
