/** @fileoverview Presents expandable content with primitive-owned visibility and focus behavior. */

import * as Primitive from '@kobalte/core/collapsible'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { JSX, ValidComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'

import { Button } from './button'

/** Native Collapsible composition; state and lifetime remain with Kobalte. */
export type CollapsibleProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.CollapsibleRootProps<T>
>
export { Root as Collapsible } from '@kobalte/core/collapsible'

/** Button variants with the owning Collapsible action. */
export type CollapsibleTriggerProps = Omit<
  PolymorphicProps<typeof Button, Primitive.CollapsibleTriggerProps<'button'>>,
  'as'
>

/** Activate the owning surface with native Button semantics. */
export function CollapsibleTrigger(props: CollapsibleTriggerProps): JSX.Element {
  return <Primitive.Trigger as={Button} {...props} />
}

/** Primitive attributes, refs and events with the shared visual treatment. */
export type CollapsibleContentProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  Primitive.CollapsibleContentProps<T>
> & { class?: string | undefined }

/** Keep expanded content in the page's ordinary layout and primitive visibility lifetime. */
export function CollapsibleContent<T extends ValidComponent = 'div'>(
  props: CollapsibleContentProps<T>,
): JSX.Element {
  return <Primitive.Content<T> {...props} class={twMerge('min-w-0 overflow-hidden', props.class)} />
}
