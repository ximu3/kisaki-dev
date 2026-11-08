/** @fileoverview Local field associations and native fieldset grouping. */

import { createSignal, createUniqueId, onCleanup, splitProps, useContext } from 'solid-js'
import type { JSX } from 'solid-js'
import { FieldContext } from '../../internal/field'
import { classes } from '../../internal/dom'
import styles from './styles.module.css'

/** id names the control; validation state is provided by the form, never inferred from :invalid. */
export interface FieldProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'id'> {
  id?: string

  invalid?: boolean
  required?: boolean
  disabled?: boolean
}

/** Associate one field's label and independent descriptions. Children retain ownership of values. */
export function Field(props: FieldProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'id',
    'invalid',
    'required',
    'disabled',
    'class',
    'children',
  ])

  const id = local.id ?? createUniqueId()
  const [label, setLabel] = createSignal(false)
  const [description, setDescription] = createSignal(false)
  const [error, setError] = createSignal(false)

  return (
    <FieldContext.Provider
      value={{
        id,
        invalid: () => !!local.invalid,
        required: () => !!local.required,
        disabled: () => !!local.disabled,
        label,
        setLabel,
        description,
        error,
        setDescription,
        setError,
      }}
    >
      <div
        {...rest}
        class={classes(styles.root, local.class)}
        data-invalid={local.invalid || undefined}
      >
        {local.children}
      </div>
    </FieldContext.Provider>
  )
}

/** A static field title names its control without becoming another activation target. */
export function FieldLabel(props: JSX.HTMLAttributes<HTMLSpanElement>): JSX.Element {
  const field = useContext(FieldContext)
  field?.setLabel(true)
  onCleanup(() => field?.setLabel(false))

  const [local, rest] = splitProps(props, ['class'])

  return (
    <span
      {...rest}
      id={field ? `${field.id}-label` : props.id}
      class={classes(styles.label, local.class)}
    />
  )
}

/** Stable usage guidance, independent of the current validation result. */
export function FieldDescription(props: JSX.HTMLAttributes<HTMLParagraphElement>): JSX.Element {
  const field = useContext(FieldContext)
  field?.setDescription(true)
  onCleanup(() => field?.setDescription(false))

  const [local, rest] = splitProps(props, ['class'])

  return (
    <p
      {...rest}
      id={field ? `${field.id}-description` : props.id}
      class={classes(styles.description, local.class)}
    />
  )
}

/** The field's own accessible error remains available while the form's visible feedback changes. */
export function FieldError(props: JSX.HTMLAttributes<HTMLParagraphElement>): JSX.Element {
  const field = useContext(FieldContext)
  field?.setError(true)
  onCleanup(() => field?.setError(false))

  const [local, rest] = splitProps(props, ['class'])

  return (
    <p
      {...rest}
      id={field ? `${field.id}-error` : props.id}
      class={classes(styles.error, local.class)}
    />
  )
}

/** Native fieldset disables its descendant controls and preserves form association. */
export function FieldGroup(props: JSX.FieldsetHTMLAttributes<HTMLFieldSetElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <fieldset {...rest} class={classes(styles.group, local.class)} />
}

/** Accessible name for a FieldGroup. */
export function FieldLegend(props: JSX.HTMLAttributes<HTMLLegendElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <legend {...rest} class={classes(styles.legend, local.class)} />
}
