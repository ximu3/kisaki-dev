import {
  onSettled,
  createMemo,
  createSignal,
  createUniqueId,
  Show,
  omit,
  useContext,
} from 'solid-js'
import type { JSX } from '@solidjs/web'
import { fieldForm, FormContext } from '../../internal/form'
import { FieldContext } from '../../internal/field'
import { Button, type ButtonProps } from '../button'
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
  const rest = omit(
    props,
    'id',
    'name',
    'orientation',
    'invalid',
    'required',
    'disabled',
    'class',
    'ref',
    'children',
  )

  const fallbackId = createUniqueId()
  const id = () => props.id || fallbackId
  const inherited = useContext(FormContext)
  let node!: HTMLDivElement
  const [field, setField] = createSignal<HTMLDivElement>()
  onSettled(() => {
    setField(node)
  })
  const form = createMemo(() => {
    const element = field()
    return element && fieldForm(element, id(), inherited ?? undefined)
  })
  const key = () => props.name ?? id()
  const issue = () =>
    form()
      ?.issues()
      .find((item) => item.id === key())
  const [label, setLabel] = createSignal(false)
  const [description, setDescription] = createSignal(false)
  const [error, setError] = createSignal(false)

  return (
    <FieldContext
      value={{
        get id() {
          return id()
        },

        invalid: () => !!(props.invalid || issue()),
        required: () => !!props.required,
        disabled: () => !!props.disabled,

        label,
        setLabel,
        description,
        setDescription,
        error: () => !!issue() || error(),
        setError,
      }}
    >
      <div
        {...rest}
        ref={[
          (element) => {
            node = element
          },
          props.ref,
        ]}
        class={[styles.root, props.class]}
        data-field-key={key()}
        data-orientation={props.orientation ?? 'vertical'}
        data-invalid={props.invalid || !!issue() || undefined}
      >
        {props.children}
        <Show when={!error() && issue()}>
          {(item) => (
            <p id={id() + '-error'} class={styles.error}>
              {item().summary}
            </p>
          )}
        </Show>
      </div>
    </FieldContext>
  )
}

/**
 * Renders a static field title associated with its control, without adding an activation target.
 */
export function FieldLabel(props: JSX.HTMLAttributes<HTMLSpanElement>): JSX.Element {
  const field = useContext(FieldContext)
  onSettled(() => {
    field?.setLabel(true)
    return () => field?.setLabel(false)
  })

  const rest = omit(props, 'class')

  return (
    <span
      {...rest}
      id={field ? `${field.id}-label` : props.id}
      class={[styles.label, props.class]}
    />
  )
}

/** Aligns a static field label with a separately named action. */
export function FieldHeader(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const rest = omit(props, 'class')
  return <div {...rest} class={[styles.header, props.class]} />
}

/** Renders a field-adjacent icon button using the current control height and an outline. */
export function FieldAction(props: ButtonProps): JSX.Element {
  return <Button variant="outline" size="icon" {...props} />
}

/** Renders stable guidance and registers its accessible association while mounted. */
export function FieldDescription(props: JSX.HTMLAttributes<HTMLParagraphElement>): JSX.Element {
  const field = useContext(FieldContext)
  onSettled(() => {
    field?.setDescription(true)
    return () => field?.setDescription(false)
  })

  const rest = omit(props, 'class')

  return (
    <p
      {...rest}
      id={field ? `${field.id}-description` : props.id}
      class={[styles.description, props.class]}
    />
  )
}

/** Renders a field's own accessible error independently of the form's changing visible feedback. */
export function FieldError(props: JSX.HTMLAttributes<HTMLParagraphElement>): JSX.Element {
  const field = useContext(FieldContext)
  onSettled(() => {
    field?.setError(true)
    return () => field?.setError(false)
  })

  const rest = omit(props, 'class')

  return (
    <p {...rest} id={field ? `${field.id}-error` : props.id} class={[styles.error, props.class]} />
  )
}

/** Groups the control and adjacent actions in a responsive field's value column. */
export function FieldContent(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const rest = omit(props, 'class')
  return <div {...rest} class={[styles.content, props.class]} />
}

/** Renders a native fieldset with browser-owned grouping and disabled-control behavior. */
export function FieldGroup(props: JSX.FieldsetHTMLAttributes<HTMLFieldSetElement>): JSX.Element {
  const rest = omit(props, 'class')

  return <fieldset {...rest} class={[styles.group, props.class]} />
}

/** Renders the native legend that names a FieldGroup. */
export function FieldLegend(props: JSX.HTMLAttributes<HTMLLegendElement>): JSX.Element {
  const rest = omit(props, 'class')

  return <legend {...rest} class={[styles.legend, props.class]} />
}
