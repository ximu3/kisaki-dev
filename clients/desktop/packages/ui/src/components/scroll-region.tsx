/** @fileoverview Keeps scroll ownership native and measurable by virtualized consumers. */

import { splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** The host supplies an accessible name, sizing and optional focus behavior for the scrolling region. */
export type ScrollRegionProps = JSX.HTMLAttributes<HTMLDivElement>

/** Expose the real overflow element through ref, without an extra viewport or synthetic wheel handling. */
export function ScrollRegion(props: ScrollRegionProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      role="region"
      tabIndex={0}
      {...rest}
      class={twMerge(
        'min-h-0 min-w-0 overflow-auto [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] focus-visible:outline-1 focus-visible:outline-ring',
        local.class,
      )}
    />
  )
}
