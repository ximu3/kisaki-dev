/** @fileoverview Styles continuous values and ranges while Kobalte owns pointer, keyboard and form behavior. */

import * as Primitive from '@kobalte/core/slider'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { JSX, ValidComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SliderProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.SliderRootProps<T>
> & { class?: string | undefined }

/** Create the control owner without copying its value or selection. */
export function Slider<T extends ValidComponent = 'div'>(props: SliderProps<T>): JSX.Element {
  return (
    <Primitive.Root<T>
      {...props}
      class={twMerge(
        'relative flex min-w-0 touch-none select-none flex-col gap-2 data-[orientation=vertical]:h-32',
        'data-[orientation=vertical]:items-center data-disabled:opacity-50',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SliderLabelProps<T extends ValidComponent = 'label'> = PolymorphicProps<
  T,
  Primitive.SliderLabelProps<T>
> & { class?: string | undefined }

/** Associate the visible name with the owning control. */
export function SliderLabel<T extends ValidComponent = 'label'>(
  props: SliderLabelProps<T>,
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
export type SliderDescriptionProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.SliderDescriptionProps<T>
> & { class?: string | undefined }

/** Associate supporting content with the owning control. */
export function SliderDescription<T extends ValidComponent = 'div'>(
  props: SliderDescriptionProps<T>,
): JSX.Element {
  return (
    <Primitive.Description<T>
      {...props}
      class={twMerge('font-ui text-sm leading-normal text-muted-foreground', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SliderErrorMessageProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.SliderErrorMessageProps<T>
> & { class?: string | undefined }

/** Show caller-owned validation feedback while the control is invalid. */
export function SliderErrorMessage<T extends ValidComponent = 'div'>(
  props: SliderErrorMessageProps<T>,
): JSX.Element {
  return (
    <Primitive.ErrorMessage<T>
      {...props}
      class={twMerge('font-ui text-sm leading-normal text-destructive', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SliderTrackProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.SliderTrackProps<T>
> & { class?: string | undefined }

/** Style the track while retaining primitive behavior. */
export function SliderTrack<T extends ValidComponent = 'div'>(
  props: SliderTrackProps<T>,
): JSX.Element {
  return (
    <Primitive.Track<T>
      {...props}
      class={twMerge(
        'relative h-1 w-full cursor-pointer rounded-full bg-muted data-[orientation=vertical]:h-full',
        'data-[orientation=vertical]:w-1 data-disabled:cursor-not-allowed',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SliderFillProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.SliderFillProps<T>
> & { class?: string | undefined }

/** Style the fill while retaining primitive behavior. */
export function SliderFill<T extends ValidComponent = 'div'>(
  props: SliderFillProps<T>,
): JSX.Element {
  return (
    <Primitive.Fill<T>
      {...props}
      class={twMerge(
        'absolute h-full rounded-full bg-primary data-[orientation=vertical]:w-full data-invalid:bg-destructive',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SliderThumbProps<T extends ValidComponent = 'span'> = PolymorphicProps<
  T,
  Primitive.SliderThumbProps<T>
> & { class?: string | undefined }

/** Style the thumb while retaining primitive behavior. */
export function SliderThumb<T extends ValidComponent = 'span'>(
  props: SliderThumbProps<T>,
): JSX.Element {
  return (
    <Primitive.Thumb<T>
      {...props}
      class={twMerge(
        'box-border top-1/2 block size-3.5 -translate-y-1/2 rounded-full border-2 border-solid border-primary',
        'bg-background shadow-raised data-[orientation=vertical]:top-auto data-[orientation=vertical]:left-1/2',
        'data-[orientation=vertical]:-translate-x-1/2 data-[orientation=vertical]:translate-y-0',
        'data-invalid:border-destructive focus-visible:outline-1 focus-visible:outline-offset-2',
        'focus-visible:outline-ring',
        props.class,
      )}
    />
  )
}

/** Native SliderInput composition; state and lifetime remain with Kobalte. */
export type SliderInputProps = Primitive.SliderInputProps
/** Submit the native value while the visible thumb supplies the single accessible slider. */
export function SliderInput(props: SliderInputProps): JSX.Element {
  return <Primitive.Input aria-hidden="true" {...props} />
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SliderValueLabelProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.SliderValueLabelProps<T>
> & { class?: string | undefined }

/** Style the value label while retaining primitive behavior. */
export function SliderValueLabel<T extends ValidComponent = 'div'>(
  props: SliderValueLabelProps<T>,
): JSX.Element {
  return (
    <Primitive.ValueLabel<T>
      {...props}
      class={twMerge('font-ui text-xs tabular-nums text-muted-foreground', props.class)}
    />
  )
}
