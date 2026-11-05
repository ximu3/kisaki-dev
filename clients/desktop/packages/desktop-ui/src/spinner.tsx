/** @fileoverview A named busy indicator with a static reduced-motion state. */

import { type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Announce ongoing work independently of the visual animation. */
export function Spinner(props: { label: string; class?: string }): JSX.Element {
  return (
    <span role="status" class={twMerge('inline-flex items-center', props.class)}>
      <span
        aria-hidden="true"
        class="ks-spinner ks-box size-4 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin"
      />
      <span class="sr-only">{props.label}</span>
    </span>
  )
}
