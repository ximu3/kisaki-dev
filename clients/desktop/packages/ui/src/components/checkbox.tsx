/** @fileoverview Styles boolean and mixed choices while Kobalte owns checked state and form participation. */

import * as Primitive from '@kobalte/core/checkbox'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { JSX, ValidComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Primitive attributes, refs and events with the shared visual treatment. */
export type CheckboxProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.CheckboxRootProps<T>
> & { class?: string | undefined }

/** Create the control owner without copying its value or selection. */
export function Checkbox<T extends ValidComponent = 'div'>(props: CheckboxProps<T>): JSX.Element {
  return (
    <Primitive.Root<T>
      {...props}
      class={twMerge(
        'group/checkbox relative inline-flex flex-wrap items-center gap-2 data-disabled:opacity-50',
        props.class,
      )}
    />
  )
}

/** Native CheckboxInput composition; state and lifetime remain with Kobalte. */
export type CheckboxInputProps<T extends ValidComponent = 'input'> = PolymorphicProps<
  T,
  Primitive.CheckboxInputProps<T>
>
/** Keep the browser reset baseline aligned with the primitive's checked value. */
export function CheckboxInput<T extends ValidComponent = 'input'>(
  props: CheckboxInputProps<T>,
): JSX.Element {
  const checkbox = Primitive.useCheckboxContext()
  return <Primitive.Input<T> {...props} prop:defaultChecked={checkbox.checked()} />
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type CheckboxControlProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.CheckboxControlProps<T>
> & { class?: string | undefined }

/** Style the control while retaining primitive behavior. */
export function CheckboxControl<T extends ValidComponent = 'div'>(
  props: CheckboxControlProps<T>,
): JSX.Element {
  return (
    <Primitive.Control<T>
      {...props}
      class={twMerge(
        'box-border flex size-3.5 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-solid',
        'border-border bg-input text-primary-foreground data-checked:border-primary data-checked:bg-primary',
        'data-indeterminate:border-primary data-indeterminate:bg-primary data-invalid:border-destructive',
        'data-disabled:cursor-not-allowed group-has-[:focus-visible]/checkbox:outline-1',
        'group-has-[:focus-visible]/checkbox:outline-offset-2 group-has-[:focus-visible]/checkbox:outline-ring',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type CheckboxIndicatorProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.CheckboxIndicatorProps<T>
> & { class?: string | undefined }

/** Style the indicator while retaining primitive behavior. */
export function CheckboxIndicator<T extends ValidComponent = 'div'>(
  props: CheckboxIndicatorProps<T>,
): JSX.Element {
  return (
    <Primitive.Indicator<T>
      {...props}
      class={twMerge(
        'flex size-3.5 shrink-0 items-center justify-center text-current empty:after:block empty:after:h-2',
        'empty:after:w-1 empty:after:rotate-45 empty:after:border-0 empty:after:border-r-2 empty:after:border-b-2 empty:after:border-solid',
        'empty:after:border-current data-indeterminate:after:h-0 data-indeterminate:after:w-2',
        'data-indeterminate:after:rotate-0 data-indeterminate:after:border-r-0',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type CheckboxLabelProps<T extends ValidComponent = 'label'> = PolymorphicProps<
  T,
  Primitive.CheckboxLabelProps<T>
> & { class?: string | undefined }

/** Associate the visible name with the owning control. */
export function CheckboxLabel<T extends ValidComponent = 'label'>(
  props: CheckboxLabelProps<T>,
): JSX.Element {
  return (
    <Primitive.Label<T>
      {...props}
      class={twMerge('font-ui text-sm font-medium leading-tight text-foreground', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type CheckboxDescriptionProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.CheckboxDescriptionProps<T>
> & { class?: string | undefined }

/** Associate supporting content with the owning control. */
export function CheckboxDescription<T extends ValidComponent = 'div'>(
  props: CheckboxDescriptionProps<T>,
): JSX.Element {
  return (
    <Primitive.Description<T>
      {...props}
      class={twMerge('font-ui text-sm leading-normal text-muted-foreground', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type CheckboxErrorMessageProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.CheckboxErrorMessageProps<T>
> & { class?: string | undefined }

/** Show caller-owned validation feedback while the control is invalid. */
export function CheckboxErrorMessage<T extends ValidComponent = 'div'>(
  props: CheckboxErrorMessageProps<T>,
): JSX.Element {
  return (
    <Primitive.ErrorMessage<T>
      {...props}
      class={twMerge('font-ui text-sm leading-normal text-destructive', props.class)}
    />
  )
}
