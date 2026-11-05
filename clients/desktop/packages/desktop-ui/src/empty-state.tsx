/** @fileoverview Present the caller's empty-state message and optional action. */

import { splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Present the caller's empty-state message and optional action. */
export function EmptyState(props: JSX.IntrinsicElements['div']): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <div
      {...rest}
      class={twMerge(
        'grid justify-items-center gap-2 px-4 py-6 text-center text-sm text-muted-foreground',
        local.class,
      )}
    />
  )
}
