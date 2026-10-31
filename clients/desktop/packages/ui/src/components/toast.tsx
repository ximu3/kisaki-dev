/** @fileoverview Presents document-local notifications; the caller chooses messages, regions and persistence. */

import * as Primitive from '@kobalte/core/toast'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { JSX, ValidComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'

import { Button, type ButtonProps } from './button'

import { splitProps } from 'solid-js'

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ToastRegionProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ToastRegionProps<T>
> & { class?: string | undefined }

/** Style the region while retaining primitive behavior. */
export function ToastRegion<T extends ValidComponent = 'div'>(
  props: ToastRegionProps<T>,
): JSX.Element {
  return (
    <Primitive.Region<T>
      {...props}
      class={twMerge(
        'pointer-events-none fixed inset-x-4 bottom-4 z-[120] flex justify-end font-ui',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ToastListProps<T extends ValidComponent = 'ol'> = PolymorphicProps<
  T,
  Primitive.ToastListProps<T>
> & { class?: string | undefined }

/** Style the list while retaining primitive behavior. */
export function ToastList<T extends ValidComponent = 'ol'>(props: ToastListProps<T>): JSX.Element {
  return (
    <Primitive.List<T>
      {...props}
      class={twMerge(
        'm-0 flex w-80 max-w-full list-none flex-col gap-2 p-0 outline-none',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ToastProps<T extends ValidComponent = 'li'> = PolymorphicProps<
  T,
  Primitive.ToastRootProps<T>
> & { class?: string | undefined }

/** Create the control owner without copying its value or selection. */
export function Toast<T extends ValidComponent = 'li'>(props: ToastProps<T>): JSX.Element {
  return (
    <Primitive.Root<T>
      {...props}
      class={twMerge(
        'pointer-events-auto relative box-border overflow-hidden rounded-md border border-solid border-border bg-popover',
        'p-3 text-popover-foreground shadow-overlay outline-none',
        'data-[swipe=move]:translate-x-[var(--kb-toast-swipe-move-x)]',
        'data-[swipe=move]:translate-y-[var(--kb-toast-swipe-move-y)] data-[swipe=cancel]:transition-transform',
        'data-[swipe=end]:translate-x-[var(--kb-toast-swipe-end-x)]',
        'data-[swipe=end]:translate-y-[var(--kb-toast-swipe-end-y)] motion-reduce:transition-none',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ToastTitleProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ToastTitleProps<T>
> & { class?: string | undefined }

/** Style the title while retaining primitive behavior. */
export function ToastTitle<T extends ValidComponent = 'div'>(
  props: ToastTitleProps<T>,
): JSX.Element {
  return (
    <Primitive.Title<T> {...props} class={twMerge('font-ui text-sm font-medium', props.class)} />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ToastDescriptionProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ToastDescriptionProps<T>
> & { class?: string | undefined }

/** Associate supporting content with the owning control. */
export function ToastDescription<T extends ValidComponent = 'div'>(
  props: ToastDescriptionProps<T>,
): JSX.Element {
  return (
    <Primitive.Description<T>
      {...props}
      class={twMerge('mt-1 font-ui text-xs leading-normal text-muted-foreground', props.class)}
    />
  )
}

/** Button variants with the owning Toast action. */
export type ToastCloseProps = Omit<
  PolymorphicProps<typeof Button, Primitive.ToastCloseButtonProps<'button'>>,
  'as'
>

/** Request closure using an explicit label or visible button content. */
export function ToastClose(props: ToastCloseProps): JSX.Element {
  return (
    <Primitive.CloseButton
      {...props}
      as={(buttonProps: ButtonProps) => {
        const [, nativeProps] = splitProps(buttonProps, ['aria-label'])
        return <Button {...nativeProps} aria-label={props['aria-label']} />
      }}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ToastProgressTrackProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ToastProgressTrackProps<T>
> & { class?: string | undefined }

/** Style the progress track while retaining primitive behavior. */
export function ToastProgressTrack<T extends ValidComponent = 'div'>(
  props: ToastProgressTrackProps<T>,
): JSX.Element {
  return (
    <Primitive.ProgressTrack<T>
      {...props}
      class={twMerge('absolute inset-x-0 bottom-0 h-0.5 bg-muted', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ToastProgressFillProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ToastProgressFillProps<T>
> & { class?: string | undefined }

/** Style the progress fill while retaining primitive behavior. */
export function ToastProgressFill<T extends ValidComponent = 'div'>(
  props: ToastProgressFillProps<T>,
): JSX.Element {
  return (
    <Primitive.ProgressFill<T>
      {...props}
      class={twMerge('h-full w-[var(--kb-toast-progress-fill-width)] bg-primary', props.class)}
    />
  )
}

/** Publish, update or dismiss toasts in the caller's chosen region. */
export { toaster } from '@kobalte/core/toast'
