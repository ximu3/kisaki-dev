/** @fileoverview Displays indeterminate activity without claiming an operation outcome. */

import { splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** A decorative activity indicator; an enclosing status or control supplies the accessible message. */
export type SpinnerProps = JSX.SvgSVGAttributes<SVGSVGElement>

/** Animate a small current-color indicator, respecting reduced motion. */
export function Spinner(props: SpinnerProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      {...rest}
      class={twMerge(
        'size-4 shrink-0 animate-spin text-current motion-reduce:animate-none',
        local.class,
      )}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity="0.25" />
      <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
      {local.children}
    </svg>
  )
}
