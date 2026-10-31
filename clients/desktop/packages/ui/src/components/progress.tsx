/** @fileoverview Displays determinate and indeterminate work supplied by its caller. */

import * as Primitive from '@kobalte/core/progress'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { JSX, ValidComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ProgressProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ProgressRootProps<T>
> & { class?: string | undefined }

/** Create the control owner without copying its value or selection. */
export function Progress<T extends ValidComponent = 'div'>(props: ProgressProps<T>): JSX.Element {
  return (
    <Primitive.Root<T> {...props} class={twMerge('flex min-w-0 flex-col gap-1.5', props.class)} />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ProgressLabelProps<T extends ValidComponent = 'span'> = PolymorphicProps<
  T,
  Primitive.ProgressLabelProps<T>
> & { class?: string | undefined }

/** Associate the visible name with the owning control. */
export function ProgressLabel<T extends ValidComponent = 'span'>(
  props: ProgressLabelProps<T>,
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
export type ProgressValueLabelProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ProgressValueLabelProps<T>
> & { class?: string | undefined }

/** Style the value label while retaining primitive behavior. */
export function ProgressValueLabel<T extends ValidComponent = 'div'>(
  props: ProgressValueLabelProps<T>,
): JSX.Element {
  return (
    <Primitive.ValueLabel<T>
      {...props}
      class={twMerge('font-ui text-xs tabular-nums text-muted-foreground', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ProgressTrackProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ProgressTrackProps<T>
> & { class?: string | undefined }

/** Style the track while retaining primitive behavior. */
export function ProgressTrack<T extends ValidComponent = 'div'>(
  props: ProgressTrackProps<T>,
): JSX.Element {
  return (
    <Primitive.Track<T>
      {...props}
      class={twMerge('h-1.5 w-full overflow-hidden rounded-full bg-muted', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ProgressFillProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ProgressFillProps<T>
> & { class?: string | undefined }

/** Style the fill while retaining primitive behavior. */
export function ProgressFill<T extends ValidComponent = 'div'>(
  props: ProgressFillProps<T>,
): JSX.Element {
  return (
    <Primitive.Fill<T>
      {...props}
      class={twMerge(
        'h-full w-[var(--kb-progress-fill-width)] rounded-full bg-primary transition-[width] data-indeterminate:w-full',
        'data-indeterminate:animate-pulse motion-reduce:animate-none motion-reduce:transition-none',
        props.class,
      )}
    />
  )
}
