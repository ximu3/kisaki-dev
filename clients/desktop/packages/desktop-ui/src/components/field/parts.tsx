/** @fileoverview Local field associations and native fieldset grouping. */

import { createSignal, createUniqueId, onCleanup, Show, splitProps, useContext } from 'solid-js'
import type { JSX } from 'solid-js'
import { FormContext } from '../../internal/form'
import { FieldContext } from '../../internal/field'
import { classes } from '../../internal/dom'
import { Button } from '../button/control'
import type { ButtonProps } from '../button/control'
import styles from './styles.module.css'

/**
 * Control identity and form-owned invalid, required and disabled state for one field.
 *
 * The id names the associated control; validation is supplied explicitly.
 */
export interface FieldProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'id'> {
  id?: string

  /** Stable identity used by the form's business validation. */
  name?: string
  orientation?: 'vertical' | 'responsive'

  invalid?: boolean
  required?: boolean
  disabled?: boolean
}

/**
 * Provides one control's identity, state and independent label, guidance and error associations.
 *
 * Child controls retain ownership of their values.
 */
export function Field(props: FieldProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'id',
    'name',
    'orientation',
    'invalid',
    'required',
    'disabled',
    'class',
    'children',
  ])

  const fallbackId = createUniqueId()
  const id = () => local.id ?? fallbackId
  const form = useContext(FormContext)
  const key = () => local.name ?? id()
  const issue = () => form?.issues().find((item) => item.id === key())
  const [label, setLabel] = createSignal(false)
  const [description, setDescription] = createSignal(false)
  const [error, setError] = createSignal(false)

  return (
    <FieldContext.Provider
      value={{
        get id() {
          return id()
        },

        /** Reads the field's current explicit invalid state. */
        invalid: () => !!(local.invalid || issue()),

        /** Reads the field's current required state for nested controls. */
        required: () => !!local.required,

        /** Reads the field's current disabled state for nested controls. */
        disabled: () => !!local.disabled,
        label,
        setLabel,
        description,
        error: () => !!issue() || error(),
        setDescription,
        setError,
      }}
    >
      <div
        {...rest}
        class={classes(styles.root, local.class)}
        data-field-key={key()}
        data-orientation={local.orientation ?? 'vertical'}
        data-invalid={local.invalid || !!issue() || undefined}
      >
        {local.children}
        <Show when={!error() && issue()}>
          {(item) => (
            <p id={id() + '-error'} class={styles.error}>
              {item().summary}
            </p>
          )}
        </Show>
      </div>
    </FieldContext.Provider>
  )
}

/**
 * Renders a static field title associated with its control, without adding an activation target.
 */
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

/** Aligns a static field label with a separately named action. */
export function FieldHeader(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])
  return <div {...rest} class={classes(styles.header, local.class)} />
}

/** Renders a field-adjacent icon button using the current control height and an outline. */
export function FieldAction(props: ButtonProps): JSX.Element {
  return <Button variant="outline" size="icon" {...props} />
}

/** Renders stable guidance and registers its accessible association while mounted. */
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

/** Renders a field's own accessible error independently of the form's changing visible feedback. */
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

/** Groups the control and adjacent actions in a responsive field's value column. */
export function FieldContent(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])
  return <div {...rest} class={classes(styles.content, local.class)} />
}

/** Renders a native fieldset with browser-owned grouping and disabled-control behavior. */
export function FieldGroup(props: JSX.FieldsetHTMLAttributes<HTMLFieldSetElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <fieldset {...rest} class={classes(styles.group, local.class)} />
}

/** Renders the native legend that names a FieldGroup. */
export function FieldLegend(props: JSX.HTMLAttributes<HTMLLegendElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <legend {...rest} class={classes(styles.legend, local.class)} />
}
