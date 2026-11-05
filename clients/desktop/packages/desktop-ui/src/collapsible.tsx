/** @fileoverview A keyboard-operable native disclosure. */

import { splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Supply summary content for the trigger and children for the disclosed section. */
export function Collapsible(
  props: JSX.DetailsHtmlAttributes<HTMLDetailsElement> & { summary: JSX.Element },
): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'summary', 'children'])

  return (
    <details
      {...rest}
      class={twMerge('ks-box rounded-md border border-border text-sm', local.class)}
    >
      <summary class="ks-focus cursor-pointer px-2 py-1.5 font-medium">{local.summary}</summary>
      <div class="px-2 pb-2">{local.children}</div>
    </details>
  )
}
