import { createContext, onSettled, useContext } from 'solid-js'
import type { Accessor } from 'solid-js'
import type { JSX } from '@solidjs/web'

/** Local control or group identity, validation state and mounted accessible-text associations. */
export interface FieldContextValue {
  id: string

  invalid: Accessor<boolean>
  required: Accessor<boolean>
  disabled: Accessor<boolean>

  label: Accessor<boolean>
  description: Accessor<boolean>
  error: Accessor<boolean>
  setLabel: (value: boolean) => void
  setDescription: (value: boolean) => void
  setError: (value: boolean) => void
}

/** Form-field labels, descriptions and validation state inherited by nested controls. */
export const FieldContext = createContext<FieldContextValue | null>(null)

/**
 * Creates reactive native attribute defaults from the nearest Field context.
 *
 * Controls spread explicit attributes after these defaults to override them.
 */
export function fieldAttributes(props: JSX.AriaAttributes, ownLabel?: Accessor<JSX.Element>) {
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
    get 'aria-labelledby'() {
      if (props['aria-label'] || ownLabel?.() != null || !field?.label()) {
        return undefined
      }
      return `${field.id}-label`
    },
    get 'aria-invalid'() {
      return field?.invalid() ? ('true' as const) : undefined
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

/**
 * Watches editor attributes and mounted ancestor fieldsets to close custom editing when the control
 * becomes unavailable.
 *
 * Owner cleanup disconnects the observer.
 */
export function closeWhenUnavailable(element: Accessor<HTMLElement>, close: () => void): void {
  onSettled(() => {
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
    return () => observer.disconnect()
  })
}
