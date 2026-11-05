/** @fileoverview Hover and keyboard descriptions that stay readable when the pointer moves onto them. */

import { createUniqueId, onCleanup, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'

export interface TooltipProps {
  content: JSX.Element
  /** Apply the description ID to the actual, independently named control. */
  children: (description: { 'aria-describedby': string }) => JSX.Element
  delayMs?: number
  class?: string
}

/** Share the same anchored hint for focus and hover, bounded by the viewport. */
export function Tooltip(props: TooltipProps): JSX.Element {
  const id = createUniqueId()
  let anchor!: HTMLSpanElement
  let hint!: HTMLDivElement
  let timer: ReturnType<typeof setTimeout> | undefined

  /** Cancel pending presentation and remove the document-level Escape listener. */
  function hide(): void {
    clearTimeout(timer)
    hint.hidePopover()
    hint.ownerDocument.removeEventListener('keydown', escape, true)
  }

  /** Dismiss this hint before Escape reaches an enclosing dialog. */
  function escape(event: KeyboardEvent): void {
    if (event.key === 'Escape' && hint.matches(':popover-open')) {
      event.preventDefault()
      event.stopPropagation()
      hide()
    }
  }

  /** Allow pointer travel and use immediate presentation for keyboard focus. */
  function show(delay: number): void {
    clearTimeout(timer)
    timer = setTimeout(() => {
      hint.showPopover({ source: anchor })
      hint.ownerDocument.addEventListener('keydown', escape, true)
    }, delay)
  }

  /** Keep the hint readable while the anchor retains keyboard focus. */
  function leave(): void {
    clearTimeout(timer)
    if (!anchor.matches(':focus-within')) {
      timer = setTimeout(hide, 150)
    }
  }
  onCleanup(hide)
  return (
    <>
      <span
        ref={(element) => {
          anchor = element
        }}
        class="inline-flex"
        onPointerEnter={() => show(props.delayMs ?? 400)}
        onPointerLeave={leave}
        onFocusIn={() => show(0)}
        onFocusOut={(event) => {
          if (!anchor.contains(event.relatedTarget as Node | null) && !anchor.matches(':hover')) {
            hide()
          }
        }}
      >
        {props.children({ 'aria-describedby': id })}
      </span>
      <div
        id={id}
        ref={(element) => {
          hint = element
        }}
        role="tooltip"
        popover="manual"
        onPointerEnter={() => clearTimeout(timer)}
        onPointerLeave={leave}
        class={twMerge(
          'ks-popover ks-box [position-area:top] rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow-overlay',
          props.class,
        )}
      >
        {props.content}
      </div>
    </>
  )
}
