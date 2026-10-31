/** @fileoverview Styles contextual actions while callers decide where an application menu is appropriate. */

import * as Primitive from '@kobalte/core/context-menu'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { JSX, ValidComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Native ContextMenu composition; state and lifetime remain with Kobalte. */
export type ContextMenuProps = Primitive.ContextMenuRootProps
export { Root as ContextMenu } from '@kobalte/core/context-menu'

/** Native ContextMenuTrigger composition; state and lifetime remain with Kobalte. */
export type ContextMenuTriggerProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ContextMenuTriggerProps<T>
>
export { Trigger as ContextMenuTrigger } from '@kobalte/core/context-menu'

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ContextMenuContentProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ContextMenuContentProps<T>
> & { class?: string | undefined }

/** Present the surface in a portal so ancestor clipping does not hide it. */
export function ContextMenuContent<T extends ValidComponent = 'div'>(
  props: ContextMenuContentProps<T>,
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
export type ContextMenuItemProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ContextMenuItemProps<T>
> & { class?: string | undefined }

/** Style the item while retaining primitive behavior. */
export function ContextMenuItem<T extends ValidComponent = 'div'>(
  props: ContextMenuItemProps<T>,
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
export type ContextMenuItemLabelProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ContextMenuItemLabelProps<T>
> & { class?: string | undefined }

/** Style the item label while retaining primitive behavior. */
export function ContextMenuItemLabel<T extends ValidComponent = 'div'>(
  props: ContextMenuItemLabelProps<T>,
): JSX.Element {
  return <Primitive.ItemLabel<T> {...props} class={twMerge('min-w-0 flex-1', props.class)} />
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ContextMenuItemDescriptionProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ContextMenuItemDescriptionProps<T>
> & { class?: string | undefined }

/** Style the item description while retaining primitive behavior. */
export function ContextMenuItemDescription<T extends ValidComponent = 'div'>(
  props: ContextMenuItemDescriptionProps<T>,
): JSX.Element {
  return (
    <Primitive.ItemDescription<T>
      {...props}
      class={twMerge('ms-auto text-xs text-muted-foreground', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ContextMenuItemIndicatorProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ContextMenuItemIndicatorProps<T>
> & { class?: string | undefined }

/** Style the item indicator while retaining primitive behavior. */
export function ContextMenuItemIndicator<T extends ValidComponent = 'div'>(
  props: ContextMenuItemIndicatorProps<T>,
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
export type ContextMenuCheckboxItemProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ContextMenuCheckboxItemProps<T>
> & { class?: string | undefined }

/** Style the checkbox item while retaining primitive behavior. */
export function ContextMenuCheckboxItem<T extends ValidComponent = 'div'>(
  props: ContextMenuCheckboxItemProps<T>,
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

/** Native ContextMenuRadioGroup composition; state and lifetime remain with Kobalte. */
export type ContextMenuRadioGroupProps<
  TValue = string,
  T extends ValidComponent = 'div',
> = PolymorphicProps<T, Primitive.ContextMenuRadioGroupProps<T, TValue>>
export { RadioGroup as ContextMenuRadioGroup } from '@kobalte/core/context-menu'

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ContextMenuRadioItemProps<
  TValue = string,
  T extends ValidComponent = 'div',
> = PolymorphicProps<T, Primitive.ContextMenuRadioItemProps<T, TValue>> & {
  class?: string | undefined
}

/** Style the radio item while retaining primitive behavior. */
export function ContextMenuRadioItem<TValue = string, T extends ValidComponent = 'div'>(
  props: ContextMenuRadioItemProps<TValue, T>,
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

/** Native ContextMenuGroup composition; state and lifetime remain with Kobalte. */
export type ContextMenuGroupProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ContextMenuGroupProps<T>
>
export { Group as ContextMenuGroup } from '@kobalte/core/context-menu'

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ContextMenuGroupLabelProps<T extends ValidComponent = 'span'> = PolymorphicProps<
  T,
  Primitive.ContextMenuGroupLabelProps<T>
> & { class?: string | undefined }

/** Style the group label while retaining primitive behavior. */
export function ContextMenuGroupLabel<T extends ValidComponent = 'span'>(
  props: ContextMenuGroupLabelProps<T>,
): JSX.Element {
  return (
    <Primitive.GroupLabel<T>
      {...props}
      class={twMerge('px-2 py-1 font-ui text-xs font-medium text-muted-foreground', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ContextMenuSeparatorProps<T extends ValidComponent = 'hr'> = PolymorphicProps<
  T,
  Primitive.ContextMenuSeparatorProps<T>
> & { class?: string | undefined }

/** Style the separator while retaining primitive behavior. */
export function ContextMenuSeparator<T extends ValidComponent = 'hr'>(
  props: ContextMenuSeparatorProps<T>,
): JSX.Element {
  return (
    <Primitive.Separator<T>
      {...props}
      class={twMerge('mx-1 my-1 h-px border-0 bg-border', props.class)}
    />
  )
}

/** Native ContextMenuSub composition; state and lifetime remain with Kobalte. */
export type ContextMenuSubProps = Primitive.ContextMenuSubProps
export { Sub as ContextMenuSub } from '@kobalte/core/context-menu'

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ContextMenuSubTriggerProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ContextMenuSubTriggerProps<T>
> & { class?: string | undefined }

/** Style the sub trigger while retaining primitive behavior. */
export function ContextMenuSubTrigger<T extends ValidComponent = 'div'>(
  props: ContextMenuSubTriggerProps<T>,
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
export type ContextMenuSubContentProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ContextMenuSubContentProps<T>
> & { class?: string | undefined }

/** Present the surface in a portal so ancestor clipping does not hide it. */
export function ContextMenuSubContent<T extends ValidComponent = 'div'>(
  props: ContextMenuSubContentProps<T>,
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
