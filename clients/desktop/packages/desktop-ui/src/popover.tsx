/** @fileoverview Anchored native popovers with button invocation, light dismiss and focus return. */

import { createUniqueId, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { Button, type ButtonProps } from './button'

export interface PopoverProps {
  /** Use the same ID with a native popoverTarget button inside the content to dismiss. */
  id?: string
  ref?: (popover: HTMLDivElement) => void
  trigger: JSX.Element
  triggerProps?: ButtonProps
  children: JSX.Element
  class?: string
  onOpenChange?: (open: boolean) => void
}

/** The browser owns open state, its invoking button and the top-layer stack. */
export function Popover(props: PopoverProps): JSX.Element {
  const generated = createUniqueId()
  const id = () => props.id ?? generated

  return (
    <>
      <Button variant="outline" {...props.triggerProps} popoverTarget={id()}>
        {props.trigger}
      </Button>
      <div
        id={id()}
        ref={props.ref}
        popover="auto"
        on:toggle={(event) => props.onOpenChange?.(event.newState === 'open')}
        class={twMerge(
          'ks-popover ks-box rounded-md border border-border bg-popover p-3 text-sm text-popover-foreground shadow-overlay',
          props.class,
        )}
      >
        {props.children}
      </div>
    </>
  )
}
