/** @fileoverview Presents editable queries and caller-supplied options without fetching business data. */

import * as Primitive from '@kobalte/core/combobox'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { JSX, ValidComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ComboboxProps<
  Option,
  OptGroup = never,
  T extends ValidComponent = 'div',
> = PolymorphicProps<T, Primitive.ComboboxRootProps<Option, OptGroup, T>> & {
  class?: string | undefined
}

/** Create the control owner without copying its value or selection. */
export function Combobox<Option, OptGroup = never, T extends ValidComponent = 'div'>(
  props: ComboboxProps<Option, OptGroup, T>,
): JSX.Element {
  return (
    <Primitive.Root<Option, OptGroup, T>
      {...props}
      class={twMerge('flex min-w-0 flex-col gap-1.5', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ComboboxLabelProps<T extends ValidComponent = 'label'> = PolymorphicProps<
  T,
  Primitive.ComboboxLabelProps<T>
> & { class?: string | undefined }

/** Associate the visible name with the owning control. */
export function ComboboxLabel<T extends ValidComponent = 'label'>(
  props: ComboboxLabelProps<T>,
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
export type ComboboxDescriptionProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ComboboxDescriptionProps<T>
> & { class?: string | undefined }

/** Associate supporting content with the owning control. */
export function ComboboxDescription<T extends ValidComponent = 'div'>(
  props: ComboboxDescriptionProps<T>,
): JSX.Element {
  return (
    <Primitive.Description<T>
      {...props}
      class={twMerge('font-ui text-sm leading-normal text-muted-foreground', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ComboboxErrorMessageProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ComboboxErrorMessageProps<T>
> & { class?: string | undefined }

/** Show caller-owned validation feedback while the control is invalid. */
export function ComboboxErrorMessage<T extends ValidComponent = 'div'>(
  props: ComboboxErrorMessageProps<T>,
): JSX.Element {
  return (
    <Primitive.ErrorMessage<T>
      {...props}
      class={twMerge('font-ui text-sm leading-normal text-destructive', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ComboboxControlProps<Option, T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ComboboxControlProps<Option, T>
> & { class?: string | undefined }

/** Style the control while retaining primitive behavior. */
export function ComboboxControl<Option, T extends ValidComponent = 'div'>(
  props: ComboboxControlProps<Option, T>,
): JSX.Element {
  return (
    <Primitive.Control<Option, T>
      {...props}
      class={twMerge(
        'box-border flex min-h-7 min-w-0 items-center gap-1 rounded-md border border-solid border-border bg-input px-2',
        'text-input-foreground focus-within:border-ring focus-within:outline-1 focus-within:outline-offset-1',
        'focus-within:outline-ring data-invalid:border-destructive data-disabled:opacity-50',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ComboboxInputProps<T extends ValidComponent = 'input'> = PolymorphicProps<
  T,
  Primitive.ComboboxInputProps<T>
> & { class?: string | undefined }

/** Style the input while retaining primitive behavior. */
export function ComboboxInput<T extends ValidComponent = 'input'>(
  props: ComboboxInputProps<T>,
): JSX.Element {
  return (
    <Primitive.Input<T>
      {...props}
      class={twMerge(
        'h-6 w-full min-w-0 border-0 bg-transparent p-0 font-ui text-sm text-inherit outline-none',
        'placeholder:text-muted-foreground disabled:cursor-not-allowed',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ComboboxTriggerProps<T extends ValidComponent = 'button'> = PolymorphicProps<
  T,
  Primitive.ComboboxTriggerProps<T>
> & { class?: string | undefined }

/** Style the trigger while retaining primitive behavior. */
export function ComboboxTrigger<T extends ValidComponent = 'button'>(
  props: ComboboxTriggerProps<T>,
): JSX.Element {
  return (
    <Primitive.Trigger<T>
      {...props}
      class={twMerge(
        'flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent',
        'text-muted-foreground hover:text-foreground disabled:cursor-not-allowed focus-visible:outline-1',
        'focus-visible:outline-offset-2 focus-visible:outline-ring',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ComboboxIconProps<T extends ValidComponent = 'span'> = PolymorphicProps<
  T,
  Primitive.ComboboxIconProps<T>
> & { class?: string | undefined }

/** Style the icon while retaining primitive behavior. */
export function ComboboxIcon<T extends ValidComponent = 'span'>(
  props: ComboboxIconProps<T>,
): JSX.Element {
  return (
    <Primitive.Icon<T>
      {...props}
      class={twMerge(
        'flex size-3 items-center justify-center empty:after:size-1.5 empty:after:rotate-45 empty:after:border-0 empty:after:border-r',
        'empty:after:border-b empty:after:border-solid empty:after:border-current',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ComboboxContentProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ComboboxContentProps<T>
> & { class?: string | undefined }

/** Present the surface in a portal so ancestor clipping does not hide it. */
export function ComboboxContent<T extends ValidComponent = 'div'>(
  props: ComboboxContentProps<T>,
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
export type ComboboxListboxProps<
  Option = unknown,
  OptGroup = never,
  T extends ValidComponent = 'ul',
> = PolymorphicProps<T, Primitive.ComboboxListboxProps<Option, OptGroup, T>> & {
  class?: string | undefined
}

/** Style the listbox while retaining primitive behavior. */
export function ComboboxListbox<
  Option = unknown,
  OptGroup = never,
  T extends ValidComponent = 'ul',
>(props: ComboboxListboxProps<Option, OptGroup, T>): JSX.Element {
  return (
    <Primitive.Listbox<Option, OptGroup, T>
      {...props}
      class={twMerge('m-0 list-none p-0 outline-none', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ComboboxItemProps<T extends ValidComponent = 'li'> = PolymorphicProps<
  T,
  Primitive.ComboboxItemProps<T>
> & { class?: string | undefined }

/** Style the item while retaining primitive behavior. */
export function ComboboxItem<T extends ValidComponent = 'li'>(
  props: ComboboxItemProps<T>,
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
export type ComboboxItemLabelProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ComboboxItemLabelProps<T>
> & { class?: string | undefined }

/** Style the item label while retaining primitive behavior. */
export function ComboboxItemLabel<T extends ValidComponent = 'div'>(
  props: ComboboxItemLabelProps<T>,
): JSX.Element {
  return (
    <Primitive.ItemLabel<T> {...props} class={twMerge('min-w-0 flex-1 truncate', props.class)} />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ComboboxItemDescriptionProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ComboboxItemDescriptionProps<T>
> & { class?: string | undefined }

/** Style the item description while retaining primitive behavior. */
export function ComboboxItemDescription<T extends ValidComponent = 'div'>(
  props: ComboboxItemDescriptionProps<T>,
): JSX.Element {
  return (
    <Primitive.ItemDescription<T>
      {...props}
      class={twMerge('text-xs text-muted-foreground', props.class)}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type ComboboxItemIndicatorProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.ComboboxItemIndicatorProps<T>
> & { class?: string | undefined }

/** Style the item indicator while retaining primitive behavior. */
export function ComboboxItemIndicator<T extends ValidComponent = 'div'>(
  props: ComboboxItemIndicatorProps<T>,
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
export type ComboboxSectionProps<T extends ValidComponent = 'li'> = PolymorphicProps<
  T,
  Primitive.ComboboxSectionProps<T>
> & { class?: string | undefined }

/** Style the section while retaining primitive behavior. */
export function ComboboxSection<T extends ValidComponent = 'li'>(
  props: ComboboxSectionProps<T>,
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

/** Native ComboboxHiddenSelect composition; state and lifetime remain with Kobalte. */
export type ComboboxHiddenSelectProps = Primitive.ComboboxHiddenSelectProps
export { HiddenSelect as ComboboxHiddenSelect } from '@kobalte/core/combobox'
