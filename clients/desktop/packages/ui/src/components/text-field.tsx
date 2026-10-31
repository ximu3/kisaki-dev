/** @fileoverview Owns accessible text-field composition, styling, and native editing attributes. */

import * as Field from '@kobalte/core/text-field'
import { splitProps, type JSX } from 'solid-js'

/** One text value and its form state. A field owns one input or textarea and its labels/descriptions. */
export type TextFieldProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, 'onChange'> & {
  readonly value?: string
  readonly defaultValue?: string
  readonly onValueChange?: (value: string) => void
  readonly name?: string
  readonly required?: boolean
  readonly disabled?: boolean
  readonly readOnly?: boolean
  readonly validationState?: 'valid' | 'invalid'
}

/** Create a reactive field owner. Controlled values follow props; uncontrolled values participate in form reset. */
export function TextField(props: TextFieldProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'onValueChange', 'id', 'ref'])
  return (
    <Field.Root
      as="div"
      class={`kisaki-field ${local.class ?? ''}`}
      {...rest}
      onChange={(value) => local.onValueChange?.(value)}
      {...(local.id === undefined ? {} : { id: local.id })}
      {...(local.ref === undefined ? {} : { ref: local.ref })}
    />
  )
}

/** Native editing attributes; the field root alone owns value and form state. */
export type TextFieldInputProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'name' | 'required' | 'disabled' | 'readOnly'
>
/** Render the field's native input without intercepting selection, clipboard, or text navigation. */
export function TextFieldInput(props: TextFieldInputProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'id', 'onInput'])
  return (
    <Field.Input<'input'>
      as="input"
      class={`kisaki-input ${local.class ?? ''}`}
      {...rest}
      {...(local.id === undefined ? {} : { id: local.id })}
      onInput={(event) => dispatchInput(local.onInput, event)}
    />
  )
}

/** Native multiline editing attributes; value and form state belong to the same field root. */
export type TextFieldTextAreaProps = Omit<
  JSX.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'value' | 'defaultValue' | 'name' | 'required' | 'disabled' | 'readOnly'
>
/** Render a multiline field with the same labeling, errors, and reset semantics as its single-line form. */
export function TextFieldTextArea(props: TextFieldTextAreaProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'class',
    'id',
    'ref',
    'onInput',
    'onKeyDown',
    'onKeyPress',
  ])
  return (
    <Field.TextArea<'textarea'>
      as="textarea"
      class={`kisaki-input kisaki-textarea ${local.class ?? ''}`}
      {...rest}
      {...(local.id === undefined ? {} : { id: local.id })}
      {...(local.ref === undefined ? {} : { ref: local.ref })}
      onInput={(event) => dispatchInput(local.onInput, event)}
      {...(local.onKeyDown === undefined ? {} : { onKeyDown: local.onKeyDown })}
      {...(local.onKeyPress === undefined ? {} : { onKeyPress: local.onKeyPress })}
    />
  )
}

/** Native label attributes; its control association is supplied by the owning field. */
export type TextFieldLabelProps = Omit<JSX.LabelHTMLAttributes<HTMLLabelElement>, 'for'>
/** Label this field's control and preserve native click-to-focus behavior. */
export function TextFieldLabel(props: TextFieldLabelProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'id'])
  return (
    <Field.Label
      as="label"
      class={`kisaki-field-label ${local.class ?? ''}`}
      {...rest}
      {...(local.id === undefined ? {} : { id: local.id })}
    />
  )
}

/** Associate helpful text with the actual input through its accessible description. */
export function TextFieldDescription(props: JSX.HTMLAttributes<HTMLSpanElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'id'])
  return (
    <Field.Description
      as="span"
      class={`kisaki-field-description ${local.class ?? ''}`}
      {...rest}
      {...(local.id === undefined ? {} : { id: local.id })}
    />
  )
}

/** Present and associate an error only while the owning field is invalid. */
export function TextFieldErrorMessage(props: JSX.HTMLAttributes<HTMLSpanElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'id'])
  return (
    <Field.ErrorMessage
      as="span"
      class={`kisaki-field-error ${local.class ?? ''}`}
      {...rest}
      {...(local.id === undefined ? {} : { id: local.id })}
    />
  )
}

/** Preserve Solid's function and bound-data callbacks after verifying the native control event target. */
function dispatchInput<Control extends HTMLInputElement | HTMLTextAreaElement>(
  handler: JSX.InputEventHandlerUnion<Control, InputEvent> | undefined,
  event: InputEvent & { currentTarget: Control; target: Element },
): void {
  if (!handler) {
    return
  }
  if (event.target !== event.currentTarget) {
    throw new Error('The input event does not belong to the native control.')
  }
  const inputEvent = event as Parameters<JSX.InputEventHandler<Control, InputEvent>>[0]
  if (typeof handler === 'function') {
    handler(inputEvent)
  } else {
    handler[0](handler[1], inputEvent)
  }
}
