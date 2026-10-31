/** @fileoverview Styles Kobalte's text-value owner and its associated native editing parts. */

import * as Primitive from '@kobalte/core/text-field'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import { splitProps, type JSX, type ValidComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'

const inputClasses = [
  'box-border w-full min-w-0 rounded-md border border-solid border-border bg-input px-2 py-1',
  'font-ui text-sm leading-normal text-input-foreground placeholder:text-muted-foreground',
  'focus-visible:border-ring focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-ring',
  'data-invalid:border-destructive data-disabled:cursor-not-allowed data-disabled:bg-muted data-disabled:opacity-50',
  'file:border-0 file:bg-transparent file:font-ui file:text-sm file:font-medium file:text-inherit',
].join(' ')

/** One text value and its form state; the root owns one Input or TextArea and its associated labels. */
export type TextFieldProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.TextFieldRootProps<T>
> & { class?: string | undefined }

/** Own controlled or uncontrolled text and form-reset behavior within the current Solid owner. */
export function TextField<T extends ValidComponent = 'div'>(props: TextFieldProps<T>): JSX.Element {
  return (
    <Primitive.Root<T> {...props} class={twMerge('flex min-w-0 flex-col gap-1.5', props.class)} />
  )
}

/** Native input attributes and primitive composition; value and form state belong to the root. */
export type TextFieldInputProps<T extends ValidComponent = 'input'> = PolymorphicProps<
  T,
  Primitive.TextFieldInputProps<T>
> & { class?: string | undefined }

/** Render the field's native input, preserving editing events, selection and composition. */
export function TextFieldInput<T extends ValidComponent = 'input'>(
  props: TextFieldInputProps<T>,
): JSX.Element {
  const field = Primitive.useTextFieldContext()

  // Native reset runs after Kobalte updates its value; keep that browser baseline in sync.
  return (
    <Primitive.Input<T>
      {...props}
      prop:defaultValue={field.value() ?? ''}
      class={twMerge(inputClasses, 'h-7', props.class)}
    />
  )
}

/** Multiline editing, including the primitive's autoResize and submitOnEnter options. */
export type TextFieldTextAreaProps<T extends ValidComponent = 'textarea'> = PolymorphicProps<
  T,
  Primitive.TextFieldTextAreaProps<T>
> & { class?: string | undefined }

/** Render the multiline form of the same text field, with native resize enabled by default. */
export function TextFieldTextArea<T extends ValidComponent = 'textarea'>(
  props: TextFieldTextAreaProps<T>,
): JSX.Element
export function TextFieldTextArea(props: TextFieldTextAreaProps): JSX.Element {
  const field = Primitive.useTextFieldContext()
  const [local, rest] = splitProps(props, ['class', 'submitOnEnter', 'onKeyDown'])

  const handleKeyDown: JSX.EventHandler<HTMLTextAreaElement, KeyboardEvent> = (event) => {
    const handler = local.onKeyDown
    if (typeof handler === 'function') {
      handler(event)
    } else if (handler) {
      handler[0](handler[1], event)
    }

    if (
      !local.submitOnEnter ||
      event.defaultPrevented ||
      event.isComposing ||
      event.key !== 'Enter' ||
      event.shiftKey
    ) {
      return
    }
    const form = event.currentTarget.form
    if (form) {
      event.preventDefault()
      form.requestSubmit()
    }
  }

  // The primitive's keypress submission omits composition state; use the current keyboard event instead.
  return (
    <Primitive.TextArea
      {...rest}
      submitOnEnter={false}
      onKeyDown={handleKeyDown}
      aria-multiline={local.submitOnEnter ? 'false' : undefined}
      {...{ 'prop:defaultValue': field.value() ?? '' }}
      class={twMerge(inputClasses, 'min-h-20 resize-y', local.class)}
    />
  )
}

/** A label associated with the owning field's actual control. */
export type TextFieldLabelProps<T extends ValidComponent = 'label'> = PolymorphicProps<
  T,
  Primitive.TextFieldLabelProps<T>
> & { class?: string | undefined }

/** Name the control and retain native click-to-focus behavior. */
export function TextFieldLabel<T extends ValidComponent = 'label'>(
  props: TextFieldLabelProps<T>,
): JSX.Element {
  return (
    <Primitive.Label<T>
      {...props}
      class={twMerge(
        'font-ui text-sm font-medium leading-tight text-foreground data-disabled:opacity-50',
        props.class,
      )}
    />
  )
}

/** Helpful text registered with the root's accessible description. */
export type TextFieldDescriptionProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.TextFieldDescriptionProps<T>
> & { class?: string | undefined }

/** Associate explanatory content with the input through Kobalte's form-control context. */
export function TextFieldDescription<T extends ValidComponent = 'div'>(
  props: TextFieldDescriptionProps<T>,
): JSX.Element {
  return (
    <Primitive.Description<T>
      {...props}
      class={twMerge('font-ui text-sm leading-normal text-muted-foreground', props.class)}
    />
  )
}

/** Error content registered and shown while the owning field is invalid. */
export type TextFieldErrorMessageProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.TextFieldErrorMessageProps<T>
> & { class?: string | undefined }

/** Present the root's invalid-state feedback; the caller owns validation and message content. */
export function TextFieldErrorMessage<T extends ValidComponent = 'div'>(
  props: TextFieldErrorMessageProps<T>,
): JSX.Element {
  return (
    <Primitive.ErrorMessage<T>
      {...props}
      class={twMerge('font-ui text-sm leading-normal text-destructive', props.class)}
    />
  )
}
