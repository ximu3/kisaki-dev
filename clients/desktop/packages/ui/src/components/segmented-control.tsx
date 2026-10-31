/** @fileoverview Presents compact radio choices, distinct from tab panels. */

import * as Primitive from '@kobalte/core/segmented-control'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import { splitProps, type JSX, type ValidComponent } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { twMerge } from 'tailwind-merge'

import type { RadioGroupLabelProps } from '@kobalte/core/radio-group'

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SegmentedControlProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.SegmentedControlRootProps
> & { class?: string | undefined }

/** Create the control owner without copying its value or selection. */
export function SegmentedControl<T extends ValidComponent = 'div'>(
  props: SegmentedControlProps<T>,
): JSX.Element {
  return (
    <Primitive.Root<T>
      {...props}
      class={twMerge(
        'relative inline-flex w-fit items-center gap-1 rounded-md bg-muted p-1 data-[orientation=vertical]:flex-col',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SegmentedControlLabelProps<T extends ValidComponent = 'span'> = PolymorphicProps<
  T,
  RadioGroupLabelProps<T>
> & { class?: string | undefined }

/** Associate the visible name with the owning control. */
export function SegmentedControlLabel<T extends ValidComponent = 'span'>(
  props: SegmentedControlLabelProps<T>,
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
export type SegmentedControlItemProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.SegmentedControlItemProps<T>
> & { class?: string | undefined }

/** Style the item while retaining primitive behavior. */
export function SegmentedControlItem<T extends ValidComponent = 'div'>(
  props: SegmentedControlItemProps<T>,
): JSX.Element {
  return (
    <Primitive.Item<T>
      {...props}
      class={twMerge('group/segment relative z-10 min-w-0 data-disabled:opacity-50', props.class)}
    />
  )
}

/** Native SegmentedControlItemInput composition; state and lifetime remain with Kobalte. */
export type SegmentedControlItemInputProps<T extends ValidComponent = 'input'> = PolymorphicProps<
  T,
  Primitive.SegmentedControlItemInputProps<T>
>
/** Align native reset with the primitive's live checked prop, retaining caller composition. */
export function SegmentedControlItemInput<T extends ValidComponent = 'input'>(
  props: SegmentedControlItemInputProps<T>,
): JSX.Element
export function SegmentedControlItemInput(props: SegmentedControlItemInputProps): JSX.Element {
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
export type SegmentedControlItemControlProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.SegmentedControlItemControlProps<T>
> & { class?: string | undefined }

/** Style the item control while retaining primitive behavior. */
export function SegmentedControlItemControl<T extends ValidComponent = 'div'>(
  props: SegmentedControlItemControlProps<T>,
): JSX.Element {
  return (
    <Primitive.ItemControl<T>
      {...props}
      class={twMerge(
        'flex h-6 cursor-pointer items-center justify-center gap-1.5 rounded-sm px-2 font-ui text-sm',
        'text-muted-foreground hover:text-foreground data-checked:bg-background data-checked:text-foreground',
        'data-checked:shadow-raised data-disabled:cursor-not-allowed group-has-[:focus-visible]/segment:outline-1',
        'group-has-[:focus-visible]/segment:outline-offset-2 group-has-[:focus-visible]/segment:outline-ring',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SegmentedControlItemLabelProps<T extends ValidComponent = 'label'> = PolymorphicProps<
  T,
  Primitive.SegmentedControlItemLabelProps<T>
> & { class?: string | undefined }

/** Style the item label while retaining primitive behavior. */
export function SegmentedControlItemLabel<T extends ValidComponent = 'label'>(
  props: SegmentedControlItemLabelProps<T>,
): JSX.Element {
  return (
    <Primitive.ItemLabel<T>
      {...props}
      class={twMerge('cursor-inherit font-ui text-sm', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SegmentedControlIndicatorProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.SegmentedControlIndicatorProps
> & { class?: string | undefined }

/** Style the indicator while retaining primitive behavior. */
export function SegmentedControlIndicator<T extends ValidComponent = 'div'>(
  props: SegmentedControlIndicatorProps<T>,
): JSX.Element {
  return (
    <Primitive.Indicator<T>
      {...props}
      class={twMerge(
        'box-border absolute rounded-sm border border-solid border-ring transition-transform duration-150',
        'motion-reduce:transition-none',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SegmentedControlDescriptionProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.SegmentedControlDescriptionProps<T>
> & { class?: string | undefined }

/** Associate supporting content with the owning control. */
export function SegmentedControlDescription<T extends ValidComponent = 'div'>(
  props: SegmentedControlDescriptionProps<T>,
): JSX.Element {
  return (
    <Primitive.Description<T>
      {...props}
      class={twMerge('font-ui text-sm leading-normal text-muted-foreground', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SegmentedControlErrorMessageProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.SegmentedControlErrorMessageProps<T>
> & { class?: string | undefined }

/** Show caller-owned validation feedback while the control is invalid. */
export function SegmentedControlErrorMessage<T extends ValidComponent = 'div'>(
  props: SegmentedControlErrorMessageProps<T>,
): JSX.Element {
  return (
    <Primitive.ErrorMessage<T>
      {...props}
      class={twMerge('font-ui text-sm leading-normal text-destructive', props.class)}
    />
  )
}
