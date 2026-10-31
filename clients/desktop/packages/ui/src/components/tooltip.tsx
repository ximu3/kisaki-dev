/** @fileoverview Presents supplemental explanations without replacing an action accessible name. */

import * as Primitive from '@kobalte/core/tooltip'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { JSX, ValidComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Native Tooltip composition; state and lifetime remain with Kobalte. */
export type TooltipProps = Primitive.TooltipRootProps
export { Root as Tooltip } from '@kobalte/core/tooltip'

/** Attach supplemental help to an existing semantic control, including Button or Link through as. */
export type TooltipTriggerProps<T extends ValidComponent = 'button'> = PolymorphicProps<
  T,
  Primitive.TooltipTriggerProps<T>
>
export { Trigger as TooltipTrigger } from '@kobalte/core/tooltip'

/** Primitive attributes, refs and events with the shared visual treatment. */
export type TooltipContentProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.TooltipContentProps<T>
> & { class?: string | undefined }

/** Present the surface in a portal so ancestor clipping does not hide it. */
export function TooltipContent<T extends ValidComponent = 'div'>(
  props: TooltipContentProps<T>,
): JSX.Element {
  return (
    <Primitive.Portal>
      <Primitive.Content<T>
        {...props}
        class={twMerge(
          'box-border z-[110] min-w-32 overflow-auto rounded-md border border-solid border-border bg-popover p-1 font-ui',
          'text-sm text-popover-foreground shadow-overlay outline-none max-w-72 px-2 py-1 text-xs',
          props.class,
        )}
      />
    </Primitive.Portal>
  )
}
