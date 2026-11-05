/** @fileoverview Synchronizes native edit and reset results with optional controlled values. */

import { createEffect, onCleanup, onMount, type Accessor } from 'solid-js'

import { afterEvent } from '../dom-events'

type FormControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLFieldSetElement

/** Observe the result after the browser's cancelable reset algorithm, including form= owners. */
export function onFormReset(element: FormControl, reset: () => void): void {
  const tree = element.getRootNode()
  const root = tree instanceof ShadowRoot ? tree : element.ownerDocument
  const pending = new Set<ReturnType<typeof setTimeout>>()

  /** Read the post-reset DOM only if the form completed its default action. */
  function handleReset(event: Event): void {
    if (event.target !== element.form) {
      return
    }
    // Browser-initiated events can run microtasks between listeners, before the default action.
    const task = setTimeout(() => {
      pending.delete(task)
      if (!event.defaultPrevented) {
        reset()
      }
    }, 0)
    pending.add(task)
  }
  root.addEventListener('reset', handleReset, true)
  onCleanup(() => {
    for (const task of pending) {
      clearTimeout(task)
    }
    root.removeEventListener('reset', handleReset, true)
  })
}

/** Coordinate native edits, controlled rejection/normalization and composition without replacing the input. */
export function bindNativeValue<T>(
  element: Accessor<FormControl>,
  value: Accessor<T | undefined>,
  read: () => T,
  write: (value: T) => void,
  changed: (value: T) => void,
  event: 'input' | 'change',
  textEditing = false,
): void {
  let composing = false
  const settle = afterEvent(sync)

  /** Apply a changed owner value without disturbing an active composition or a matching selection. */
  function sync(): void {
    const next = value()
    if (!composing && next !== undefined && next !== read()) {
      write(next)
    }
  }

  /** Deliver the native value before reconciling a controlled rejection. */
  function edited(): void {
    if (!composing) {
      if (value() !== undefined) {
        settle()
      }
      changed(read())
    }
  }

  /** Leave the editable DOM with the input method until it commits. */
  function start(): void {
    composing = true
  }

  /** Deliver the committed composition through the regular edit path. */
  function end(): void {
    composing = false
    edited()
  }

  createEffect(sync)
  onMount(() => {
    const control = element()
    control.addEventListener(event, edited)
    if (textEditing) {
      control.addEventListener('compositionstart', start)
      control.addEventListener('compositionend', end)
    }
    onFormReset(control, edited)
    onCleanup(() => {
      control.removeEventListener(event, edited)
      control.removeEventListener('compositionstart', start)
      control.removeEventListener('compositionend', end)
    })
  })
}

/** Shared density, focus and error treatment for editable fields. */
export const inputClass =
  'ks-control min-w-0 w-full rounded-md border border-border bg-input px-2 py-1 text-sm text-input-foreground placeholder:text-muted-foreground aria-invalid:border-destructive user-invalid:border-destructive disabled:bg-muted'
