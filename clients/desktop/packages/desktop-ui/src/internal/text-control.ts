/** @fileoverview Text value synchronization preserves native editing and IME composition. */

import { createEffect, onCleanup, onMount, untrack } from 'solid-js'
import type { Accessor } from 'solid-js'
import { createValue, onFormReset } from './state'

/** Optional value selects controlled mode; successful resets request the current defaultValue. */
export interface TextValueProps {
  value?: string | undefined
  defaultValue?: string | undefined
  onValueChange?: ((value: string) => void) | undefined
}

/** Connect one native editable element. Composition defers external writes until compositionend. */
export function bindTextControl(
  props: TextValueProps,
  element: Accessor<HTMLInputElement | HTMLTextAreaElement>,
) {
  const [value, change] = createValue(
    () => props.value,
    () => props.defaultValue ?? '',
    (next) => props.onValueChange?.(next),
  )
  let composing = false
  const sync = () => {
    const node = element()
    if (!composing && node.value !== value()) {
      node.value = value()
    }
  }

  onMount(() => {
    const node = element()
    let active = true

    const start = () => {
      composing = true
    }
    const end = () => {
      composing = false
      queueMicrotask(() => {
        if (active) {
          sync()
        }
      })
    }

    node.addEventListener('compositionstart', start)
    node.addEventListener('compositionend', end)
    createEffect(() => {
      node.defaultValue = props.defaultValue ?? ''
      untrack(sync)
    })
    createEffect(sync)
    onCleanup(() => {
      active = false
      node.removeEventListener('compositionstart', start)
      node.removeEventListener('compositionend', end)
    })
  })

  onFormReset(element, () => {
    change(props.defaultValue ?? '')
    sync()
  })

  return () => {
    change(element().value)
    untrack(sync)
  }
}
