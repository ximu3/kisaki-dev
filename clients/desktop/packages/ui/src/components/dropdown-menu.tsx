/** @fileoverview Styles action menus, nested menus and choices with primitive-owned focus. */

import * as Primitive from '@kobalte/core/dropdown-menu'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { JSX, ValidComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'

import { Button } from './button'

/** Native DropdownMenu composition; state and lifetime remain with Kobalte. */
export type DropdownMenuProps = Primitive.DropdownMenuRootProps
export { Root as DropdownMenu } from '@kobalte/core/dropdown-menu'

/** Button variants with the owning DropdownMenu action. */
export type DropdownMenuTriggerProps = Omit<
  PolymorphicProps<typeof Button, Primitive.DropdownMenuTriggerProps<'button'>>,
  'as'
>

/** Activate the owning surface with native Button semantics. */
export function DropdownMenuTrigger(props: DropdownMenuTriggerProps): JSX.Element {
  return <Primitive.Trigger as={Button} {...props} />
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type DropdownMenuContentProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.DropdownMenuContentProps<T>
> & { class?: string | undefined }

/** Present the surface in a portal so ancestor clipping does not hide it. */
export function DropdownMenuContent<T extends ValidComponent = 'div'>(
  props: DropdownMenuContentProps<T>,
): JSX.Element {
  return (
    <Primitive.Portal>
      <Primitive.Content<T>
        {...props}
        class={twMerge(
          'box-border z-[110] min-w-32 overflow-auto rounded-md border border-solid border-border bg-popover p-1 font-ui',
          'text-sm text-popover-foreground shadow-overlay outline-none max-h-[var(--kb-popper-content-available-height)]',
          props.class,
        )}
      />
    </Primitive.Portal>
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type DropdownMenuItemProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.DropdownMenuItemProps<T>
> & { class?: string | undefined }

/** Style the item while retaining primitive behavior. */
export function DropdownMenuItem<T extends ValidComponent = 'div'>(
  props: DropdownMenuItemProps<T>,
): JSX.Element {
  return (
    <Primitive.Item<T>
      {...props}
      class={twMerge(
        'relative flex min-w-0 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 outline-none',
        'data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none',
        'data-disabled:opacity-50',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type DropdownMenuItemLabelProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.DropdownMenuItemLabelProps<T>
> & { class?: string | undefined }

/** Style the item label while retaining primitive behavior. */
export function DropdownMenuItemLabel<T extends ValidComponent = 'div'>(
  props: DropdownMenuItemLabelProps<T>,
): JSX.Element {
  return <Primitive.ItemLabel<T> {...props} class={twMerge('min-w-0 flex-1', props.class)} />
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type DropdownMenuItemDescriptionProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.DropdownMenuItemDescriptionProps<T>
> & { class?: string | undefined }

/** Style the item description while retaining primitive behavior. */
export function DropdownMenuItemDescription<T extends ValidComponent = 'div'>(
  props: DropdownMenuItemDescriptionProps<T>,
): JSX.Element {
  return (
    <Primitive.ItemDescription<T>
      {...props}
      class={twMerge('ms-auto text-xs text-muted-foreground', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type DropdownMenuItemIndicatorProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.DropdownMenuItemIndicatorProps<T>
> & { class?: string | undefined }

/** Style the item indicator while retaining primitive behavior. */
export function DropdownMenuItemIndicator<T extends ValidComponent = 'div'>(
  props: DropdownMenuItemIndicatorProps<T>,
): JSX.Element {
  return (
    <Primitive.ItemIndicator<T>
      {...props}
      class={twMerge(
        'flex size-3.5 shrink-0 items-center justify-center text-current empty:after:block empty:after:h-2',
        'empty:after:w-1 empty:after:rotate-45 empty:after:border-0 empty:after:border-r-2 empty:after:border-b-2 empty:after:border-solid',
        'empty:after:border-current',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type DropdownMenuCheckboxItemProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.DropdownMenuCheckboxItemProps<T>
> & { class?: string | undefined }

/** Style the checkbox item while retaining primitive behavior. */
export function DropdownMenuCheckboxItem<T extends ValidComponent = 'div'>(
  props: DropdownMenuCheckboxItemProps<T>,
): JSX.Element {
  return (
    <Primitive.CheckboxItem<T>
      {...props}
      class={twMerge(
        'relative flex min-w-0 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 outline-none',
        'data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none',
        'data-disabled:opacity-50',
        props.class,
      )}
    />
  )
}

/** Native DropdownMenuRadioGroup composition; state and lifetime remain with Kobalte. */
export type DropdownMenuRadioGroupProps<
  TValue = string,
  T extends ValidComponent = 'div',
> = PolymorphicProps<T, Primitive.DropdownMenuRadioGroupProps<T, TValue>>
export { RadioGroup as DropdownMenuRadioGroup } from '@kobalte/core/dropdown-menu'

/** Primitive attributes, refs and events with the shared visual treatment. */
export type DropdownMenuRadioItemProps<
  TValue = string,
  T extends ValidComponent = 'div',
> = PolymorphicProps<T, Primitive.DropdownMenuRadioItemProps<T, TValue>> & {
  class?: string | undefined
}

/** Style the radio item while retaining primitive behavior. */
export function DropdownMenuRadioItem<TValue = string, T extends ValidComponent = 'div'>(
  props: DropdownMenuRadioItemProps<TValue, T>,
): JSX.Element {
  return (
    <Primitive.RadioItem<TValue, T>
      {...props}
      class={twMerge(
        'relative flex min-w-0 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 outline-none',
        'data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none',
        'data-disabled:opacity-50',
        props.class,
      )}
    />
  )
}

/** Native DropdownMenuGroup composition; state and lifetime remain with Kobalte. */
export type DropdownMenuGroupProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.DropdownMenuGroupProps<T>
>
export { Group as DropdownMenuGroup } from '@kobalte/core/dropdown-menu'

/** Primitive attributes, refs and events with the shared visual treatment. */
export type DropdownMenuGroupLabelProps<T extends ValidComponent = 'span'> = PolymorphicProps<
  T,
  Primitive.DropdownMenuGroupLabelProps<T>
> & { class?: string | undefined }

/** Style the group label while retaining primitive behavior. */
export function DropdownMenuGroupLabel<T extends ValidComponent = 'span'>(
  props: DropdownMenuGroupLabelProps<T>,
): JSX.Element {
  return (
    <Primitive.GroupLabel<T>
      {...props}
      class={twMerge('px-2 py-1 font-ui text-xs font-medium text-muted-foreground', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type DropdownMenuSeparatorProps<T extends ValidComponent = 'hr'> = PolymorphicProps<
  T,
  Primitive.DropdownMenuSeparatorProps<T>
> & { class?: string | undefined }

/** Style the separator while retaining primitive behavior. */
export function DropdownMenuSeparator<T extends ValidComponent = 'hr'>(
  props: DropdownMenuSeparatorProps<T>,
): JSX.Element {
  return (
    <Primitive.Separator<T>
      {...props}
      class={twMerge('mx-1 my-1 h-px border-0 bg-border', props.class)}
    />
  )
}

/** Native DropdownMenuSub composition; state and lifetime remain with Kobalte. */
export type DropdownMenuSubProps = Primitive.DropdownMenuSubProps
export { Sub as DropdownMenuSub } from '@kobalte/core/dropdown-menu'

/** Primitive attributes, refs and events with the shared visual treatment. */
export type DropdownMenuSubTriggerProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.DropdownMenuSubTriggerProps<T>
> & { class?: string | undefined }

/** Style the sub trigger while retaining primitive behavior. */
export function DropdownMenuSubTrigger<T extends ValidComponent = 'div'>(
  props: DropdownMenuSubTriggerProps<T>,
): JSX.Element {
  return (
    <Primitive.SubTrigger<T>
      {...props}
      class={twMerge(
        'relative flex min-w-0 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 outline-none',
        'data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none',
        'data-disabled:opacity-50 after:ms-auto after:size-1.5 after:-rotate-45 after:border-0 after:border-r after:border-b',
        'after:border-solid after:border-current rtl:after:rotate-135',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type DropdownMenuSubContentProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.DropdownMenuSubContentProps<T>
> & { class?: string | undefined }

/** Present the surface in a portal so ancestor clipping does not hide it. */
export function DropdownMenuSubContent<T extends ValidComponent = 'div'>(
  props: DropdownMenuSubContentProps<T>,
): JSX.Element {
  return (
    <Primitive.Portal>
      <Primitive.SubContent<T>
        {...props}
        class={twMerge(
          'box-border z-[110] min-w-32 overflow-auto rounded-md border border-solid border-border bg-popover p-1 font-ui',
          'text-sm text-popover-foreground shadow-overlay outline-none max-h-[var(--kb-popper-content-available-height)]',
          props.class,
        )}
      />
    </Primitive.Portal>
  )
}
