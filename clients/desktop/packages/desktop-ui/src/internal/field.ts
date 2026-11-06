/** @fileoverview Associates controls with the nearest field's label, description and own error. */

import { createContext, onCleanup, onMount, useContext } from 'solid-js'
import type { Accessor } from 'solid-js'

/** Field state stays local to a single control or a group with one accessible name. */
export interface FieldContextValue {
  id: string

  invalid: Accessor<boolean>
  required: Accessor<boolean>
  disabled: Accessor<boolean>

  description: Accessor<boolean>
  error: Accessor<boolean>
  setDescription: (value: boolean) => void
  setError: (value: boolean) => void
}

export const FieldContext = createContext<FieldContextValue>()

/** Reactive native attributes; explicit control attributes may override these defaults. */
export function fieldAttributes() {
  const field = useContext(FieldContext)

  return {
    get id() {
      return field?.id
    },
    get required() {
      return field?.required()
    },
    get disabled() {
      return field?.disabled()
    },
    get 'aria-invalid'() {
      return field?.invalid() || undefined
    },
    get 'aria-describedby'() {
      const ids = []
      if (field?.description()) {
        ids.push(`${field.id}-description`)
      }
      if (field?.invalid() && field.error()) {
        ids.push(`${field.id}-error`)
      }

      return ids.join(' ') || undefined
    },
  }
}

/** Native disabled and readonly state also closes an active custom editing interaction. */
export function closeWhenUnavailable(element: Accessor<HTMLElement>, close: () => void): void {
  onMount(() => {
    const node = element()
    const sync = () => {
      if (node.matches(':disabled') || node.hasAttribute('readonly')) {
        close()
      }
    }
    const observer = new MutationObserver(sync)
    observer.observe(node, { attributes: true, attributeFilter: ['disabled', 'readonly'] })
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      if (parent.tagName === 'FIELDSET') {
        observer.observe(parent, { attributes: true, attributeFilter: ['disabled'] })
      }
    }
    onCleanup(() => observer.disconnect())
  })
}
