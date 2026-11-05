/** @fileoverview Show native progress. Omit value for an indeterminate operation. */

import { splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Show native progress. Omit value for an indeterminate operation. */
export function Progress(props: JSX.IntrinsicElements['progress']): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <progress
      {...rest}
      class={twMerge(
        'ks-progress ks-box block h-1.5 w-full appearance-none overflow-hidden rounded-full bg-muted accent-primary',
        local.class,
      )}
    />
  )
}
