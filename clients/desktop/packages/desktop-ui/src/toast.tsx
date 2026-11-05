/** @fileoverview View-owned notifications. Mounting, updating by identity and dismissal belong to the caller. */

import { children, createEffect, createSignal, onCleanup, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { Button } from './button'

/** Mount within the owning view or dialog, so dismissal actions remain reachable. */
export function ToastRegion(props: {
  label: string
  children: JSX.Element
  class?: string
}): JSX.Element {
  return (
    <section
      aria-label={props.label}
      class={twMerge(
        'pointer-events-none fixed right-3 bottom-3 z-50 grid max-w-[min(24rem,calc(100vw-1.5rem))] gap-2',
        props.class,
      )}
    >
      {props.children}
    </section>
  )
}

export interface ToastProps {
  message: JSX.Element
  action?: JSX.Element
  urgent?: boolean
  /** Omit for a persistent message. Reading or focusing the toast pauses dismissal. */
  durationMs?: number
  dismissLabel: string
  onDismiss: () => void
}

/** Report dismissal once per timer. Removing or updating the toast cancels the previous timer. */
export function Toast(props: ToastProps): JSX.Element {
  const message = children(() => props.message)
  const [hover, setHover] = createSignal(false)
  const [focus, setFocus] = createSignal(false)
  createEffect(() => {
    const duration = props.durationMs
    if (message() != null && duration !== undefined && !hover() && !focus()) {
      const timer = setTimeout(() => props.onDismiss(), duration)
      onCleanup(() => clearTimeout(timer))
    }
  })

  return (
    <div
      class="ks-box pointer-events-auto flex items-start gap-2 rounded-md border border-border bg-popover p-2 text-sm text-popover-foreground shadow-overlay"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocusIn={() => setFocus(true)}
      onFocusOut={(e) =>
        setFocus(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))
      }
    >
      <div class="grid flex-1 gap-1">
        <div role={props.urgent ? 'alert' : 'status'}>{message()}</div>
        {props.action}
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={props.dismissLabel}
        onClick={props.onDismiss}
      >
        ×
      </Button>
    </div>
  )
}
