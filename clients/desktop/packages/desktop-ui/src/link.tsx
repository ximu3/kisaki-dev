/** @fileoverview Navigate with a native link, preserving modifier-click and context menu behavior. */

import { splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Navigate with a native link, preserving modifier-click and context menu behavior. */
export function Link(props: JSX.IntrinsicElements['a']): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <a
      {...rest}
      class={twMerge('ks-focus text-primary underline-offset-2 hover:underline', local.class)}
    />
  )
}
