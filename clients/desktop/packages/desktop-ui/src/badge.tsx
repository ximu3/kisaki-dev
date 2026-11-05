/** @fileoverview Label a short status or category. */

import { splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Label a short status or category. */
export function Badge(props: JSX.IntrinsicElements['span']): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <span
      {...rest}
      class={twMerge(
        'ks-box inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground',
        local.class,
      )}
    />
  )
}
