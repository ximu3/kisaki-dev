/** @fileoverview Presents short status labels using Kobalte's semantic badge primitive. */

import * as Primitive from '@kobalte/core/badge'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import { splitProps, type JSX, type ValidComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** A visual status; meaning and visible text belong to the caller. */
export type BadgeVariant =
  'primary' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning' | 'info'

const variants: Record<BadgeVariant, string> = {
  primary: 'border-primary/20 bg-primary/10 text-primary',
  secondary: 'border-border bg-secondary text-secondary-foreground',
  outline: 'border-border bg-transparent text-foreground',
  destructive: 'border-destructive/20 bg-destructive/10 text-destructive',
  success: 'border-success/20 bg-success/10 text-success',
  warning: 'border-warning/20 bg-warning/10 text-warning',
  info: 'border-info/20 bg-info/10 text-info',
}

/** Inline status content; this component does not become an action when styled. */
export type BadgeProps<T extends ValidComponent = 'span'> = PolymorphicProps<
  T,
  Primitive.BadgeRootProps<T>
> & {
  class?: string | undefined
  variant?: BadgeVariant
}

/** Display caller-owned status text at compact control density. */
export function Badge<T extends ValidComponent = 'span'>(props: BadgeProps<T>): JSX.Element
export function Badge(props: BadgeProps): JSX.Element {
  const [local, rest] = splitProps(props, ['variant', 'class'])

  return (
    <Primitive.Root
      {...rest}
      class={twMerge(
        'box-border inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-solid px-1.5 py-0.5 font-ui text-xs font-medium leading-none',
        variants[local.variant ?? 'primary'],
        local.class,
      )}
    />
  )
}
