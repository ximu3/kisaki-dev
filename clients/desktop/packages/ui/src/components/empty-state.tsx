/** @fileoverview Arranges an explanation and optional recovery actions for an empty view. */

import { splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Caller-owned explanation, illustrations and actions; no data or loading inference. */
export type EmptyStateProps = JSX.HTMLAttributes<HTMLDivElement>

/** Center a view's explicit empty-state content. */
export function EmptyState(props: EmptyStateProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      {...rest}
      class={twMerge(
        'flex min-w-0 flex-col items-center justify-center gap-2 p-6 text-center font-ui text-foreground',
        local.class,
      )}
    />
  )
}

/** Give the empty view a clear, visible explanation. */
export function EmptyStateTitle(props: JSX.HTMLAttributes<HTMLHeadingElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])
  return <h3 {...rest} class={twMerge('m-0 text-sm font-medium', local.class)} />
}

/** Explain what can happen next without inventing an operation result. */
export function EmptyStateDescription(
  props: JSX.HTMLAttributes<HTMLParagraphElement>,
): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <p
      {...rest}
      class={twMerge('m-0 max-w-sm text-xs leading-normal text-muted-foreground', local.class)}
    />
  )
}
