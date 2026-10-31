/** @fileoverview Styles navigation while preserving real destinations and router composition. */

import * as Primitive from '@kobalte/core/link'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { JSX, ValidComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Primitive attributes, refs and events with the shared visual treatment. */
export type LinkProps<T extends ValidComponent = 'a'> = PolymorphicProps<
  T,
  Primitive.LinkRootProps<T>
> & { class?: string | undefined }

/** Create the control owner without copying its value or selection. */
export function Link<T extends ValidComponent = 'a'>(props: LinkProps<T>): JSX.Element {
  return (
    <Primitive.Root<T>
      {...props}
      class={twMerge(
        'cursor-pointer rounded-sm font-ui text-primary underline-offset-4 hover:underline',
        'data-disabled:cursor-not-allowed data-disabled:opacity-50 focus-visible:outline-1',
        'focus-visible:outline-offset-2 focus-visible:outline-ring',
        props.class,
      )}
    />
  )
}
