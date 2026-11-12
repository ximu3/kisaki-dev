/** @fileoverview Associates controls with the nearest field's label, description and own error. */

import { createContext, onCleanup, onMount, useContext } from 'solid-js'
import type { Accessor, JSX } from 'solid-js'

/** Local control or group identity, validation state and mounted accessible-text associations. */
export interface FieldContextValue {
  id: string

  /** Reads form-owned validation state for the field. */
  invalid: Accessor<boolean>
  /** Reads the field's required-value intent. */
  required: Accessor<boolean>
  /** Reads the field's disabled-control intent. */
  disabled: Accessor<boolean>

  /** Reads whether the field label is mounted. */
  label: Accessor<boolean>
  /** Reads whether persistent field guidance is mounted. */
  description: Accessor<boolean>
  /** Reads whether the field's own error description is mounted. */
  error: Accessor<boolean>
  /** Updates label presence for accessible naming. */
  setLabel: (value: boolean) => void
  /** Updates guidance presence for accessible description. */
  setDescription: (value: boolean) => void
  /** Updates error-description presence for invalid-field association. */
  setError: (value: boolean) => void
}

export const FieldContext = createContext<FieldContextValue>()

/**
 * Creates reactive native attribute defaults from the nearest Field context.
 *
 * Controls spread explicit attributes after these defaults to override them.
 */
export function fieldAttributes(props: JSX.AriaAttributes, ownLabel?: Accessor<JSX.Element>) {
  const field = useContext(FieldContext)

  return {
    /** Reads the associated control identity from the nearest field. */
    get id() {
      return field?.id
    },
    /** Reads the nearest field's required-state default. */
    get required() {
      return field?.required()
    },
    /** Reads the nearest field's disabled-state default. */
    get disabled() {
      return field?.disabled()
    },
    /**
     * Supplies the mounted field label when no explicit accessible label or inline label takes
     * precedence.
     */
    get 'aria-labelledby'() {
      if (props['aria-label'] || ownLabel?.() != null || !field?.label()) {
        return undefined
      }
      return `${field.id}-label`
    },
    /** Exposes the field's invalid state only when it is active. */
    get 'aria-invalid'() {
      return field?.invalid() || undefined
    },
    /** Combines mounted guidance with the field's own error when invalid. */
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

/**
 * Watches editor attributes and mounted ancestor fieldsets to close custom editing when the control
 * becomes unavailable.
 *
 * Owner cleanup disconnects the observer.
 */
export function closeWhenUnavailable(element: Accessor<HTMLElement>, close: () => void): void {
  onMount(() => {
    const node = element()
    /** Requests closing when native disabled or readonly state prevents editing. */
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
