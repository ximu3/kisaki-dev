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

export interface FieldProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'id'> {
  id?: string

  name?: string
  orientation?: 'vertical' | 'responsive'

  invalid?: boolean
  required?: boolean
  disabled?: boolean
}

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

export function FieldHeader(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const rest = omit(props, 'class')
  return <div {...rest} class={[styles.header, props.class]} />
}

export function FieldAction(props: ButtonProps): JSX.Element {
  return <Button variant="outline" size="icon" {...props} />
}

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

export function FieldContent(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const rest = omit(props, 'class')
  return <div {...rest} class={[styles.content, props.class]} />
}

export function FieldGroup(props: JSX.FieldsetHTMLAttributes<HTMLFieldSetElement>): JSX.Element {
  const rest = omit(props, 'class')

  return <fieldset {...rest} class={[styles.group, props.class]} />
}

export function FieldLegend(props: JSX.HTMLAttributes<HTMLLegendElement>): JSX.Element {
  const rest = omit(props, 'class')

  return <legend {...rest} class={[styles.legend, props.class]} />
}
