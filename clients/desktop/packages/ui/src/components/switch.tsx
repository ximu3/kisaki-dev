/** @fileoverview Styles binary settings without duplicating the primitive value or native input. */

import * as Primitive from '@kobalte/core/switch'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { JSX, ValidComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SwitchProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.SwitchRootProps<T>
> & { class?: string | undefined }

/** Create the control owner without copying its value or selection. */
export function Switch<T extends ValidComponent = 'div'>(props: SwitchProps<T>): JSX.Element {
  return (
    <Primitive.Root<T>
      {...props}
      class={twMerge(
        'group/switch relative inline-flex flex-wrap items-center gap-2 data-disabled:opacity-50',
        props.class,
      )}
    />
  )
}

/** Native SwitchInput composition; state and lifetime remain with Kobalte. */
export type SwitchInputProps<T extends ValidComponent = 'input'> = PolymorphicProps<
  T,
  Primitive.SwitchInputProps<T>
>
/** Keep the browser reset baseline aligned with the primitive's checked value. */
export function SwitchInput<T extends ValidComponent = 'input'>(
  props: SwitchInputProps<T>,
): JSX.Element {
  const control = Primitive.useSwitchContext()
  return <Primitive.Input<T> {...props} prop:defaultChecked={control.checked()} />
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SwitchControlProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.SwitchControlProps<T>
> & { class?: string | undefined }

/** Style the control while retaining primitive behavior. */
export function SwitchControl<T extends ValidComponent = 'div'>(
  props: SwitchControlProps<T>,
): JSX.Element {
  return (
    <Primitive.Control<T>
      {...props}
      class={twMerge(
        'box-border inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border border-solid',
        'border-border bg-muted p-0.5 transition-colors data-checked:border-primary data-checked:bg-primary',
        'data-invalid:border-destructive data-disabled:cursor-not-allowed group-has-[:focus-visible]/switch:outline-1',
        'group-has-[:focus-visible]/switch:outline-offset-2 group-has-[:focus-visible]/switch:outline-ring',
        'motion-reduce:transition-none',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SwitchThumbProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.SwitchThumbProps<T>
> & { class?: string | undefined }

/** Style the thumb while retaining primitive behavior. */
export function SwitchThumb<T extends ValidComponent = 'div'>(
  props: SwitchThumbProps<T>,
): JSX.Element {
  return (
    <Primitive.Thumb<T>
      {...props}
      class={twMerge(
        'block size-2.5 rounded-full bg-foreground/70 transition-transform data-checked:translate-x-3',
        'data-checked:bg-primary-foreground rtl:data-checked:-translate-x-3 motion-reduce:transition-none',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SwitchLabelProps<T extends ValidComponent = 'label'> = PolymorphicProps<
  T,
  Primitive.SwitchLabelProps<T>
> & { class?: string | undefined }

/** Associate the visible name with the owning control. */
export function SwitchLabel<T extends ValidComponent = 'label'>(
  props: SwitchLabelProps<T>,
): JSX.Element {
  return (
    <Primitive.Label<T>
      {...props}
      class={twMerge('font-ui text-sm font-medium leading-tight text-foreground', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SwitchDescriptionProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.SwitchDescriptionProps<T>
> & { class?: string | undefined }

/** Associate supporting content with the owning control. */
export function SwitchDescription<T extends ValidComponent = 'div'>(
  props: SwitchDescriptionProps<T>,
): JSX.Element {
  return (
    <Primitive.Description<T>
      {...props}
      class={twMerge('font-ui text-sm leading-normal text-muted-foreground', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SwitchErrorMessageProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.SwitchErrorMessageProps<T>
> & { class?: string | undefined }

/** Show caller-owned validation feedback while the control is invalid. */
export function SwitchErrorMessage<T extends ValidComponent = 'div'>(
  props: SwitchErrorMessageProps<T>,
): JSX.Element {
  return (
    <Primitive.ErrorMessage<T>
      {...props}
      class={twMerge('font-ui text-sm leading-normal text-destructive', props.class)}
    />
  )
}
