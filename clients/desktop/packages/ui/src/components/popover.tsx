/** @fileoverview Styles anchored interactive surfaces and delegates visibility and dismissal to Kobalte. */

import * as Primitive from '@kobalte/core/popover'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { JSX, ValidComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'

import { Button, type ButtonProps } from './button'

import { splitProps } from 'solid-js'

/** Native Popover composition; state and lifetime remain with Kobalte. */
export type PopoverProps = Primitive.PopoverRootProps
export { Root as Popover } from '@kobalte/core/popover'

/** Native PopoverAnchor composition; state and lifetime remain with Kobalte. */
export type PopoverAnchorProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.PopoverAnchorProps<T>
>
export { Anchor as PopoverAnchor } from '@kobalte/core/popover'

/** Button variants with the owning Popover action. */
export type PopoverTriggerProps = Omit<
  PolymorphicProps<typeof Button, Primitive.PopoverTriggerProps<'button'>>,
  'as'
>

/** Activate the owning surface with native Button semantics. */
export function PopoverTrigger(props: PopoverTriggerProps): JSX.Element {
  return <Primitive.Trigger as={Button} {...props} />
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type PopoverContentProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.PopoverContentProps<T>
> & { class?: string | undefined }

/** Present the surface in a portal so ancestor clipping does not hide it. */
export function PopoverContent<T extends ValidComponent = 'div'>(
  props: PopoverContentProps<T>,
): JSX.Element {
  return (
    <Primitive.Portal>
      <Primitive.Content<T>
        {...props}
        class={twMerge(
          'box-border z-[110] min-w-32 overflow-auto rounded-md border border-solid border-border bg-popover p-1 font-ui',
          'text-sm text-popover-foreground shadow-overlay outline-none max-h-[var(--kb-popper-content-available-height)]',
          'w-64 p-3',
          props.class,
        )}
      />
    </Primitive.Portal>
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type PopoverTitleProps<T extends ValidComponent = 'h2'> = PolymorphicProps<
  T,
  Primitive.PopoverTitleProps<T>
> & { class?: string | undefined }

/** Style the title while retaining primitive behavior. */
export function PopoverTitle<T extends ValidComponent = 'h2'>(
  props: PopoverTitleProps<T>,
): JSX.Element {
  return (
    <Primitive.Title<T>
      {...props}
      class={twMerge('m-0 font-ui text-sm font-medium', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type PopoverDescriptionProps<T extends ValidComponent = 'p'> = PolymorphicProps<
  T,
  Primitive.PopoverDescriptionProps<T>
> & { class?: string | undefined }

/** Associate supporting content with the owning control. */
export function PopoverDescription<T extends ValidComponent = 'p'>(
  props: PopoverDescriptionProps<T>,
): JSX.Element {
  return (
    <Primitive.Description<T>
      {...props}
      class={twMerge('m-0 mt-1 font-ui text-xs text-muted-foreground', props.class)}
    />
  )
}

/** Button variants with the owning Popover action. */
export type PopoverCloseProps = Omit<
  PolymorphicProps<typeof Button, Primitive.PopoverCloseButtonProps<'button'>>,
  'as'
>

/** Request closure using an explicit label or visible button content. */
export function PopoverClose(props: PopoverCloseProps): JSX.Element {
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
