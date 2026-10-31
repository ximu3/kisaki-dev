/** @fileoverview Presents caller-owned choices through Kobalte collection, focus and form semantics. */

import * as Primitive from '@kobalte/core/select'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { JSX, ValidComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SelectProps<
  Option,
  OptGroup = never,
  T extends ValidComponent = 'div',
> = PolymorphicProps<T, Primitive.SelectRootProps<Option, OptGroup, T>> & {
  class?: string | undefined
}

/** Create the control owner without copying its value or selection. */
export function Select<Option, OptGroup = never, T extends ValidComponent = 'div'>(
  props: SelectProps<Option, OptGroup, T>,
): JSX.Element {
  return (
    <Primitive.Root<Option, OptGroup, T>
      {...props}
      class={twMerge('flex min-w-0 flex-col gap-1.5', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SelectLabelProps<T extends ValidComponent = 'span'> = PolymorphicProps<
  T,
  Primitive.SelectLabelProps<T>
> & { class?: string | undefined }

/** Associate the visible name with the owning control. */
export function SelectLabel<T extends ValidComponent = 'span'>(
  props: SelectLabelProps<T>,
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
export type SelectDescriptionProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.SelectDescriptionProps<T>
> & { class?: string | undefined }

/** Associate supporting content with the owning control. */
export function SelectDescription<T extends ValidComponent = 'div'>(
  props: SelectDescriptionProps<T>,
): JSX.Element {
  return (
    <Primitive.Description<T>
      {...props}
      class={twMerge('font-ui text-sm leading-normal text-muted-foreground', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SelectErrorMessageProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.SelectErrorMessageProps<T>
> & { class?: string | undefined }

/** Show caller-owned validation feedback while the control is invalid. */
export function SelectErrorMessage<T extends ValidComponent = 'div'>(
  props: SelectErrorMessageProps<T>,
): JSX.Element {
  return (
    <Primitive.ErrorMessage<T>
      {...props}
      class={twMerge('font-ui text-sm leading-normal text-destructive', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SelectTriggerProps<T extends ValidComponent = 'button'> = PolymorphicProps<
  T,
  Primitive.SelectTriggerProps<T>
> & { class?: string | undefined }

/** Style the trigger while retaining primitive behavior. */
export function SelectTrigger<T extends ValidComponent = 'button'>(
  props: SelectTriggerProps<T>,
): JSX.Element {
  return (
    <Primitive.Trigger<T>
      {...props}
      class={twMerge(
        'box-border inline-flex h-7 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md border',
        'border-solid border-border bg-input px-2 font-ui text-sm text-input-foreground',
        'data-placeholder:text-muted-foreground data-invalid:border-destructive data-disabled:cursor-not-allowed',
        'data-disabled:opacity-50 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ring',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SelectValueProps<Option, T extends ValidComponent = 'span'> = PolymorphicProps<
  T,
  Primitive.SelectValueProps<Option, T>
> & { class?: string | undefined }

/** Style the value while retaining primitive behavior. */
export function SelectValue<Option, T extends ValidComponent = 'span'>(
  props: SelectValueProps<Option, T>,
): JSX.Element {
  return (
    <Primitive.Value<Option, T>
      {...props}
      class={twMerge('min-w-0 truncate text-start', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SelectIconProps<T extends ValidComponent = 'span'> = PolymorphicProps<
  T,
  Primitive.SelectIconProps<T>
> & { class?: string | undefined }

/** Style the icon while retaining primitive behavior. */
export function SelectIcon<T extends ValidComponent = 'span'>(
  props: SelectIconProps<T>,
): JSX.Element {
  return (
    <Primitive.Icon<T>
      {...props}
      class={twMerge(
        'flex size-3 shrink-0 items-center justify-center empty:after:size-1.5 empty:after:rotate-45 empty:after:border-0',
        'empty:after:border-r empty:after:border-b empty:after:border-solid empty:after:border-current',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SelectContentProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.SelectContentProps<T>
> & { class?: string | undefined }

/** Present the surface in a portal so ancestor clipping does not hide it. */
export function SelectContent<T extends ValidComponent = 'div'>(
  props: SelectContentProps<T>,
): JSX.Element {
  return (
    <Primitive.Portal>
      <Primitive.Content<T>
        {...props}
        class={twMerge(
          'box-border z-[110] min-w-32 overflow-auto rounded-md border border-solid border-border bg-popover p-1 font-ui',
          'text-sm text-popover-foreground shadow-overlay outline-none',
          'max-h-[min(24rem,var(--kb-popper-content-available-height))] min-w-[var(--kb-popper-anchor-width)]',
          props.class,
        )}
      />
    </Primitive.Portal>
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SelectListboxProps<
  Option = unknown,
  OptGroup = never,
  T extends ValidComponent = 'ul',
> = PolymorphicProps<T, Primitive.SelectListboxProps<Option, OptGroup, T>> & {
  class?: string | undefined
}

/** Style the listbox while retaining primitive behavior. */
export function SelectListbox<Option = unknown, OptGroup = never, T extends ValidComponent = 'ul'>(
  props: SelectListboxProps<Option, OptGroup, T>,
): JSX.Element {
  return (
    <Primitive.Listbox<Option, OptGroup, T>
      {...props}
      class={twMerge('m-0 list-none p-0 outline-none', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SelectItemProps<T extends ValidComponent = 'li'> = PolymorphicProps<
  T,
  Primitive.SelectItemProps<T>
> & { class?: string | undefined }

/** Style the item while retaining primitive behavior. */
export function SelectItem<T extends ValidComponent = 'li'>(
  props: SelectItemProps<T>,
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
export type SelectItemLabelProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.SelectItemLabelProps<T>
> & { class?: string | undefined }

/** Style the item label while retaining primitive behavior. */
export function SelectItemLabel<T extends ValidComponent = 'div'>(
  props: SelectItemLabelProps<T>,
): JSX.Element {
  return (
    <Primitive.ItemLabel<T> {...props} class={twMerge('min-w-0 flex-1 truncate', props.class)} />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SelectItemDescriptionProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.SelectItemDescriptionProps<T>
> & { class?: string | undefined }

/** Style the item description while retaining primitive behavior. */
export function SelectItemDescription<T extends ValidComponent = 'div'>(
  props: SelectItemDescriptionProps<T>,
): JSX.Element {
  return (
    <Primitive.ItemDescription<T>
      {...props}
      class={twMerge('text-xs text-muted-foreground', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type SelectItemIndicatorProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.SelectItemIndicatorProps<T>
> & { class?: string | undefined }

/** Style the item indicator while retaining primitive behavior. */
export function SelectItemIndicator<T extends ValidComponent = 'div'>(
  props: SelectItemIndicatorProps<T>,
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
export type SelectSectionProps<T extends ValidComponent = 'li'> = PolymorphicProps<
  T,
  Primitive.SelectSectionProps<T>
> & { class?: string | undefined }

/** Style the section while retaining primitive behavior. */
export function SelectSection<T extends ValidComponent = 'li'>(
  props: SelectSectionProps<T>,
): JSX.Element {
  return (
    <Primitive.Section<T>
      {...props}
      class={twMerge(
        'list-none py-1 [&>[role=presentation]]:px-2 [&>[role=presentation]]:py-1 [&>[role=presentation]]:text-xs',
        '[&>[role=presentation]]:text-muted-foreground',
        props.class,
      )}
    />
  )
}

/** Native SelectHiddenSelect composition; state and lifetime remain with Kobalte. */
export type SelectHiddenSelectProps = Primitive.SelectHiddenSelectProps
export { HiddenSelect as SelectHiddenSelect } from '@kobalte/core/select'
