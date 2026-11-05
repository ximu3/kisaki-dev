/** @fileoverview Desktop action buttons and their compact, icon and emphasis variants. */

import { splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'

const variants = {
  default:
    'bg-primary text-primary-foreground border-primary enabled:hover:bg-primary/90 enabled:active:bg-primary/80',
  destructive:
    'bg-destructive text-destructive-foreground border-destructive enabled:hover:bg-destructive/90 enabled:active:bg-destructive/80',
  outline:
    'border-border bg-transparent text-foreground enabled:hover:bg-accent enabled:hover:text-accent-foreground enabled:active:bg-accent/80',
  secondary:
    'bg-secondary text-secondary-foreground border-border enabled:hover:bg-accent enabled:active:bg-accent/80',
  input:
    'border-border bg-input text-input-foreground enabled:hover:bg-accent enabled:active:bg-accent/80',
  ghost:
    'border-transparent bg-transparent enabled:hover:bg-accent enabled:hover:text-accent-foreground enabled:active:bg-accent/80',
  link: 'border-transparent bg-transparent text-primary enabled:hover:underline',
  text: 'border-transparent bg-transparent text-muted-foreground enabled:hover:text-foreground',
}

const sizes = {
  xs: 'h-5 px-1.5 text-xs',
  sm: 'h-6 px-2 text-xs',
  default: 'h-7 px-3 text-sm',
  lg: 'h-8 px-4 text-sm',
  'icon-xs': 'size-5 p-0',
  'icon-sm': 'size-6 p-0',
  icon: 'size-7 p-0',
  'icon-lg': 'size-8 p-0',
}

/** Native button attributes. Supply an accessible name for an icon-only action. */
export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
}

/** Perform an action. Form submission requires type="submit". */
export function Button(props: ButtonProps): JSX.Element {
  const [local, rest] = splitProps(props, ['variant', 'size', 'class'])

  return (
    <button
      type="button"
      {...rest}
      class={twMerge(
        'ks-control inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-medium motion-safe:transition-colors [&_svg]:shrink-0',
        variants[local.variant ?? 'default'],
        sizes[local.size ?? 'default'],
        local.class,
      )}
    />
  )
}
