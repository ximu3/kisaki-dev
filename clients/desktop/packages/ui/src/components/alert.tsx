/** @fileoverview Presents important feedback with primitive-owned announcement semantics. */

import * as Primitive from '@kobalte/core/alert'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import { splitProps, type JSX, type ValidComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Visual message roles; content and timing are chosen by the caller. */
export type AlertVariant = 'default' | 'destructive' | 'info' | 'success' | 'warning'

const variants: Record<AlertVariant, string> = {
  default: 'border-border bg-surface text-surface-foreground',
  destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
  info: 'border-info/30 bg-info/10 text-info',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
}

/** Live feedback plus visual severity; ordinary page text should remain ordinary text. */
export type AlertProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.AlertRootProps<T>
> & {
  class?: string | undefined
  variant?: AlertVariant
}

/** Announce caller-supplied feedback without inferring success or failure. */
export function Alert<T extends ValidComponent = 'div'>(props: AlertProps<T>): JSX.Element
export function Alert(props: AlertProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'variant'])

  return (
    <Primitive.Root
      {...rest}
      class={twMerge(
        'box-border rounded-md border border-solid p-3 font-ui text-sm leading-normal',
        variants[local.variant ?? 'default'],
        local.class,
      )}
    />
  )
}

/** Name the feedback with a visible heading. */
export function AlertTitle(props: JSX.HTMLAttributes<HTMLHeadingElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])
  return <h3 {...rest} class={twMerge('m-0 font-ui text-sm font-medium', local.class)} />
}

/** Add detail or recovery actions using the caller's content. */
export function AlertDescription(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])
  return <div {...rest} class={twMerge('mt-1 text-xs leading-normal', local.class)} />
}
