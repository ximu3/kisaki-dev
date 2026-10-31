/** @fileoverview Displays host-owned image sources and explicit loading or failure content. */

import * as Primitive from '@kobalte/core/image'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { JSX, ValidComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ImageProps<T extends ValidComponent = 'span'> = PolymorphicProps<
  T,
  Primitive.ImageRootProps<T>
> & { class?: string | undefined }

/** Create the control owner without copying its value or selection. */
export function Image<T extends ValidComponent = 'span'>(props: ImageProps<T>): JSX.Element {
  return (
    <Primitive.Root<T>
      {...props}
      class={twMerge('relative inline-flex overflow-hidden rounded-md bg-muted', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ImageImgProps<T extends ValidComponent = 'img'> = PolymorphicProps<
  T,
  Primitive.ImageImgProps<T>
> & { class?: string | undefined }

/** Style the img while retaining primitive behavior. */
export function ImageImg<T extends ValidComponent = 'img'>(props: ImageImgProps<T>): JSX.Element {
  return (
    <Primitive.Img<T> {...props} class={twMerge('block size-full object-cover', props.class)} />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ImageFallbackProps<T extends ValidComponent = 'span'> = PolymorphicProps<
  T,
  Primitive.ImageFallbackProps<T>
> & { class?: string | undefined }

/** Style the fallback while retaining primitive behavior. */
export function ImageFallback<T extends ValidComponent = 'span'>(
  props: ImageFallbackProps<T>,
): JSX.Element {
  return (
    <Primitive.Fallback<T>
      {...props}
      class={twMerge(
        'flex size-full items-center justify-center font-ui text-sm text-muted-foreground',
        props.class,
      )}
    />
  )
}
