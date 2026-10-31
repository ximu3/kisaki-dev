/** @fileoverview Adds Kisaki button variants and density to Kobalte's accessible action primitive. */

import * as Primitive from '@kobalte/core/button'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import { splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Visual action roles; navigation still belongs to a Link. */
export type ButtonVariant =
  'primary' | 'destructive' | 'outline' | 'secondary' | 'input' | 'ghost' | 'link' | 'text'

/** Compact control heights: xs 1.25, sm 1.5, md 1.75 and lg 2 rem; the host owns document scale. */
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border-primary bg-primary text-primary-foreground enabled:hover:bg-primary/90 enabled:active:bg-primary/80',
  destructive:
    'border-destructive bg-destructive text-destructive-foreground enabled:hover:bg-destructive/90 enabled:active:bg-destructive/80',
  outline:
    'border-border bg-transparent text-foreground enabled:hover:bg-accent enabled:hover:text-accent-foreground enabled:active:bg-accent/80',
  secondary:
    'border-border bg-secondary text-secondary-foreground enabled:hover:bg-accent enabled:active:bg-accent/80',
  input: 'border-border bg-input text-input-foreground enabled:active:bg-accent/80',
  ghost:
    'border-transparent bg-transparent text-foreground enabled:hover:bg-accent enabled:hover:text-accent-foreground enabled:active:bg-accent/80',
  link: 'border-transparent bg-transparent text-primary enabled:hover:underline',
  text: 'border-transparent bg-transparent text-muted-foreground enabled:hover:text-foreground',
}

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'h-5 px-1.5 py-0 text-xs',
  sm: 'h-6 px-2 py-0.5 text-xs',
  md: 'h-7 px-3 py-1 text-sm',
  lg: 'h-8 px-4 py-1.5 text-sm',
}

/** Kobalte action semantics plus visual variants. Icon-only content requires an accessible name. */
export type ButtonProps = Omit<
  PolymorphicProps<'button', Primitive.ButtonRootProps<'button'>>,
  'as'
> & {
  variant?: ButtonVariant
  size?: ButtonSize
  iconOnly?: boolean
}

/** Render a primary medium button by default, preserving the primitive's ref, form and keyboard behavior. */
export function Button(props: ButtonProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'variant', 'size', 'iconOnly'])

  return (
    <Primitive.Root
      as="button"
      {...rest}
      class={twMerge(
        'box-border inline-flex shrink-0 appearance-none items-center justify-center gap-1.5 whitespace-nowrap',
        'rounded-md border border-solid font-ui font-medium leading-none no-underline cursor-pointer',
        'transition-colors duration-150 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
        '[&>svg]:pointer-events-none [&>svg]:size-4 [&>svg]:shrink-0',
        variantClasses[local.variant ?? 'primary'],
        sizeClasses[local.size ?? 'md'],
        local.iconOnly && 'aspect-square w-auto p-0',
        local.class,
      )}
    />
  )
}
