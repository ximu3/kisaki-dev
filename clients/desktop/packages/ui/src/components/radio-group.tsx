/** @fileoverview Styles exclusive choices with one form and keyboard owner. */

import * as Primitive from '@kobalte/core/radio-group'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import { splitProps, type JSX, type ValidComponent } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { twMerge } from 'tailwind-merge'

/** Primitive attributes, refs and events with the shared visual treatment. */
export type RadioGroupProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.RadioGroupRootProps<T>
> & { class?: string | undefined }

/** Create the control owner without copying its value or selection. */
export function RadioGroup<T extends ValidComponent = 'div'>(
  props: RadioGroupProps<T>,
): JSX.Element {
  return <Primitive.Root<T> {...props} class={twMerge('flex flex-col gap-2', props.class)} />
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type RadioGroupLabelProps<T extends ValidComponent = 'span'> = PolymorphicProps<
  T,
  Primitive.RadioGroupLabelProps<T>
> & { class?: string | undefined }

/** Associate the visible name with the owning control. */
export function RadioGroupLabel<T extends ValidComponent = 'span'>(
  props: RadioGroupLabelProps<T>,
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

/** Primitive attributes, refs and events with the shared visual treatment. */
export type RadioGroupDescriptionProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.RadioGroupDescriptionProps<T>
> & { class?: string | undefined }

/** Associate supporting content with the owning control. */
export function RadioGroupDescription<T extends ValidComponent = 'div'>(
  props: RadioGroupDescriptionProps<T>,
): JSX.Element {
  return (
    <Primitive.Description<T>
      {...props}
      class={twMerge('font-ui text-sm leading-normal text-muted-foreground', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type RadioGroupErrorMessageProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.RadioGroupErrorMessageProps<T>
> & { class?: string | undefined }

/** Show caller-owned validation feedback while the control is invalid. */
export function RadioGroupErrorMessage<T extends ValidComponent = 'div'>(
  props: RadioGroupErrorMessageProps<T>,
): JSX.Element {
  return (
    <Primitive.ErrorMessage<T>
      {...props}
      class={twMerge('font-ui text-sm leading-normal text-destructive', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type RadioGroupItemProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.RadioGroupItemProps<T>
> & { class?: string | undefined }

/** Style the item while retaining primitive behavior. */
export function RadioGroupItem<T extends ValidComponent = 'div'>(
  props: RadioGroupItemProps<T>,
): JSX.Element {
  return (
    <Primitive.Item<T>
      {...props}
      class={twMerge(
        'group/radio relative flex items-center gap-2 data-disabled:opacity-50',
        props.class,
      )}
    />
  )
}

/** Native RadioGroupItemInput composition; state and lifetime remain with Kobalte. */
export type RadioGroupItemInputProps<T extends ValidComponent = 'input'> = PolymorphicProps<
  T,
  Primitive.RadioGroupItemInputProps<T>
>
/** Align native reset with the primitive's live checked prop, retaining caller composition. */
export function RadioGroupItemInput<T extends ValidComponent = 'input'>(
  props: RadioGroupItemInputProps<T>,
): JSX.Element
export function RadioGroupItemInput(props: RadioGroupItemInputProps): JSX.Element {
  const [local, rest] = splitProps(props, ['as'])
  return (
    <Primitive.ItemInput
      {...rest}
      as={(inputProps: JSX.InputHTMLAttributes<HTMLInputElement>) => (
        <Dynamic
          component={local.as ?? 'input'}
          {...inputProps}
          {...{ 'prop:defaultChecked': inputProps.checked }}
        />
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type RadioGroupItemControlProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.RadioGroupItemControlProps<T>
> & { class?: string | undefined }

/** Style the item control while retaining primitive behavior. */
export function RadioGroupItemControl<T extends ValidComponent = 'div'>(
  props: RadioGroupItemControlProps<T>,
): JSX.Element {
  return (
    <Primitive.ItemControl<T>
      {...props}
      class={twMerge(
        'box-border flex size-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full border border-solid',
        'border-border bg-input data-checked:border-primary data-invalid:border-destructive',
        'data-disabled:cursor-not-allowed group-has-[:focus-visible]/radio:outline-1',
        'group-has-[:focus-visible]/radio:outline-offset-2 group-has-[:focus-visible]/radio:outline-ring',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type RadioGroupItemIndicatorProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.RadioGroupItemIndicatorProps<T>
> & { class?: string | undefined }

/** Style the item indicator while retaining primitive behavior. */
export function RadioGroupItemIndicator<T extends ValidComponent = 'div'>(
  props: RadioGroupItemIndicatorProps<T>,
): JSX.Element {
  return (
    <Primitive.ItemIndicator<T>
      {...props}
      class={twMerge('size-1.5 rounded-full bg-primary', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type RadioGroupItemLabelProps<T extends ValidComponent = 'label'> = PolymorphicProps<
  T,
  Primitive.RadioGroupItemLabelProps<T>
> & { class?: string | undefined }

/** Style the item label while retaining primitive behavior. */
export function RadioGroupItemLabel<T extends ValidComponent = 'label'>(
  props: RadioGroupItemLabelProps<T>,
): JSX.Element {
  return (
    <Primitive.ItemLabel<T>
      {...props}
      class={twMerge('font-ui text-sm font-medium leading-tight text-foreground', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type RadioGroupItemDescriptionProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.RadioGroupItemDescriptionProps<T>
> & { class?: string | undefined }

/** Style the item description while retaining primitive behavior. */
export function RadioGroupItemDescription<T extends ValidComponent = 'div'>(
  props: RadioGroupItemDescriptionProps<T>,
): JSX.Element {
  return (
    <Primitive.ItemDescription<T>
      {...props}
      class={twMerge('font-ui text-sm leading-normal text-muted-foreground', props.class)}
    />
  )
}
