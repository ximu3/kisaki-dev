/** @fileoverview Separate related sections with a thematic break. */

import { splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Separate related sections with a thematic break. */
export function Separator(props: JSX.IntrinsicElements['hr']): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])
  return <hr {...rest} class={twMerge('ks-box my-2 w-full border-t border-border', local.class)} />
}
