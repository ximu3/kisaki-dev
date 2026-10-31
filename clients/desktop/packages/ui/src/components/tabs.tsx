/** @fileoverview Styles tab selection and panels without owning their view data. */

import * as Primitive from '@kobalte/core/tabs'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { JSX, ValidComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Primitive attributes, refs and events with the shared visual treatment. */
export type TabsProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.TabsRootProps<T>
> & { class?: string | undefined }

/** Create the control owner without copying its value or selection. */
export function Tabs<T extends ValidComponent = 'div'>(props: TabsProps<T>): JSX.Element {
  return (
    <Primitive.Root<T>
      {...props}
      class={twMerge(
        'flex min-w-0 flex-col gap-2 data-[orientation=vertical]:flex-row',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type TabsListProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.TabsListProps<T>
> & { class?: string | undefined }

/** Style the list while retaining primitive behavior. */
export function TabsList<T extends ValidComponent = 'div'>(props: TabsListProps<T>): JSX.Element {
  return (
    <Primitive.List<T>
      {...props}
      class={twMerge(
        'relative inline-flex w-fit items-center gap-1 rounded-md bg-muted p-1 data-[orientation=vertical]:flex-col',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type TabsTriggerProps<T extends ValidComponent = 'button'> = PolymorphicProps<
  T,
  Primitive.TabsTriggerProps<T>
> & { class?: string | undefined }

/** Style the trigger while retaining primitive behavior. */
export function TabsTrigger<T extends ValidComponent = 'button'>(
  props: TabsTriggerProps<T>,
): JSX.Element {
  return (
    <Primitive.Trigger<T>
      {...props}
      class={twMerge(
        'relative z-10 box-border inline-flex h-6 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-sm',
        'border-0 bg-transparent px-2 font-ui text-sm text-muted-foreground hover:text-foreground',
        'data-selected:bg-background data-selected:text-foreground data-selected:shadow-raised',
        'disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-1 focus-visible:outline-offset-2',
        'focus-visible:outline-ring',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type TabsContentProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.TabsContentProps<T>
> & { class?: string | undefined }

/** Present the selected panel beside its owning tab list. */
export function TabsContent<T extends ValidComponent = 'div'>(
  props: TabsContentProps<T>,
): JSX.Element {
  return (
    <Primitive.Content<T>
      {...props}
      class={twMerge(
        'min-h-0 min-w-0 flex-1 outline-none focus-visible:outline-1 focus-visible:outline-ring',
        props.class,
      )}
    />
  )
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type TabsIndicatorProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.TabsIndicatorProps<T>
> & { class?: string | undefined }

/** Style the indicator while retaining primitive behavior. */
export function TabsIndicator<T extends ValidComponent = 'div'>(
  props: TabsIndicatorProps<T>,
): JSX.Element {
  return (
    <Primitive.Indicator<T>
      {...props}
      class={twMerge(
        'box-border absolute rounded-sm border border-solid border-ring transition-transform duration-150',
        'data-[orientation=horizontal]:bottom-0 data-[orientation=vertical]:left-0 motion-reduce:transition-none',
        props.class,
      )}
    />
  )
}
