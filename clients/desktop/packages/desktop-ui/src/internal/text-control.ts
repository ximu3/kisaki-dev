/** @fileoverview Text value synchronization preserves native editing and IME composition. */

import { createEffect, flush, onSettled } from 'solid-js'
import type { Accessor } from 'solid-js'
import { createValue, onFormReset } from './state'
import { nativeValidityChanged } from './form'

/** Controlled text or a local default baseline with native-edit and reset notification. */
export interface TextValueProps {
  value?: string | undefined
  defaultValue?: string | undefined
  /** Reports text requested by native input or an accepted reset to the current default value. */
  onValueChange?: ((value: string) => void) | undefined
}

/**
 * Binds one native editable element to text ownership and form reset within the current Solid
 * owner.
 *
 * Composition defers external writes; the returned updater publishes native edits and
 * resynchronizes the owned value.
 */
export function bindTextControl(
  props: TextValueProps,
  element: Accessor<HTMLInputElement | HTMLTextAreaElement>,
) {
  /** Live text value and owner-directed updates shared by native text controls. */
  const [value, change] = createValue(
    () => props.value,
    () => props.defaultValue ?? '',
    (next) => props.onValueChange?.(next),
  )
  let composing = false
  /** Writes changed owned text to the native element only outside active composition. */
  const sync = (next = value()) => {
    const node = element()
    if (!composing && node.value !== next) {
      node.value = next
      nativeValidityChanged(node.form)
    }
  }

  onSettled(() => {
    const node = element()
    let active = true
    /** Marks composition active so external text synchronization waits. */
    const start = () => {
      composing = true
    }
    /** Ends composition and queues synchronization guarded by the binding's remaining lifetime. */
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
    return () => {
      active = false
      node.removeEventListener('compositionstart', start)
      node.removeEventListener('compositionend', end)
    }
  })

  createEffect(
    () => [props.defaultValue ?? '', value()],
    ([initial, next]) => {
      element().defaultValue = initial
      sync(next)
    },
  )

  /** Settles the value owner before a native callback reads or submits the control. */
  function commit(next: string) {
    change(next)
    flush()
    sync()
  }

  const flushReset = onFormReset(element, () => commit(props.defaultValue ?? ''))
  return () => {
    const next = element().value
    flushReset()
    commit(next)
  }
}
