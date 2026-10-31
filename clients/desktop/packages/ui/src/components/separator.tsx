/** @fileoverview Gives semantic separators a shared color and orientation. */

import * as Primitive from '@kobalte/core/separator'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { JSX, ValidComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Native separator attributes and horizontal or vertical orientation. */
export type SeparatorProps<T extends ValidComponent = 'hr'> = PolymorphicProps<
  T,
  Primitive.SeparatorRootProps<T>
> & { class?: string | undefined }

/** Separate related sections without introducing layout margins. */
export function Separator<T extends ValidComponent = 'hr'>(props: SeparatorProps<T>): JSX.Element {
  return (
    <Primitive.Root<T>
      {...props}
      class={twMerge(
        'm-0 h-px w-full shrink-0 border-0 bg-border data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
        props.class,
      )}
    />
  )
}
