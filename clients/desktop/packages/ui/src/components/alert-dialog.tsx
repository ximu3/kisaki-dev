/** @fileoverview Composes themed alert-dialog surfaces with Kobalte focus, visibility and dismissal semantics. */

import * as Primitive from '@kobalte/core/alert-dialog'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import { splitProps, type JSX, type ValidComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { Button } from './button'
import type { ButtonProps } from './button'

/** The primitive owns visibility and descendant associations; a controlled host decides when to close. */
export { Root as AlertDialog } from '@kobalte/core/alert-dialog'
export type { AlertDialogRootProps as AlertDialogProps } from '@kobalte/core/alert-dialog'

/** A themed native trigger with the owning dialog's activation and return-focus behavior. */
export type AlertDialogTriggerProps = Omit<
  PolymorphicProps<typeof Button, Primitive.AlertDialogTriggerProps<'button'>>,
  'as'
>

/** Open the owning dialog using Button's variants and native form semantics. */
export function AlertDialogTrigger(props: AlertDialogTriggerProps): JSX.Element {
  return <Primitive.Trigger as={Button} {...props} />
}

/** A themed close action; a controlled host can retain open while it coordinates confirmation. */
export type AlertDialogCloseProps = Omit<
  PolymorphicProps<typeof Button, Primitive.AlertDialogCloseButtonProps<'button'>>,
  'as'
>

/** Request closure through Kobalte; this component does not save data or await a business decision. */
export function AlertDialogClose(props: AlertDialogCloseProps): JSX.Element {
  return (
    <Primitive.CloseButton
      {...props}
      as={(buttonProps: ButtonProps) => {
        // Visible content supplies the native name unless the caller provides an explicit label.
        const [, nativeProps] = splitProps(buttonProps, ['aria-label'])
        return <Button {...nativeProps} aria-label={props['aria-label']} />
      }}
    />
  )
}

/** Surface attributes and the primitive's cancellable focus and dismissal events. */
export type AlertDialogContentProps = Omit<
  PolymorphicProps<'div', Primitive.AlertDialogContentProps<'div'>>,
  'as'
>

/** Portal one modal surface; AlertDialogTitle supplies its accessible name. The host owns asynchronous closing. */
export function AlertDialogContent(props: AlertDialogContentProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <Primitive.Portal>
      <Primitive.Overlay class="fixed inset-0 z-[100] bg-black/45" />
      <Primitive.Content
        as="div"
        {...rest}
        class={twMerge(
          'box-border fixed top-1/2 left-1/2 z-[101] max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-md border border-solid border-border bg-dialog p-4 font-ui text-dialog-foreground shadow-modal outline-none',
          local.class,
        )}
      >
        {local.children}
      </Primitive.Content>
    </Primitive.Portal>
  )
}

/** Heading attributes associated with the owning dialog surface. */
export type AlertDialogTitleProps<T extends ValidComponent = 'h2'> = PolymorphicProps<
  T,
  Primitive.AlertDialogTitleProps<T>
> & { class?: string | undefined }

/** Name the dialog with a real heading and preserve Kobalte's accessible association. */
export function AlertDialogTitle<T extends ValidComponent = 'h2'>(
  props: AlertDialogTitleProps<T>,
): JSX.Element {
  return (
    <Primitive.Title<T>
      {...props}
      class={twMerge('m-0 min-w-0 truncate font-ui text-sm font-medium', props.class)}
    />
  )
}

/** Description attributes associated with the owning dialog surface. */
export type AlertDialogDescriptionProps<T extends ValidComponent = 'p'> = PolymorphicProps<
  T,
  Primitive.AlertDialogDescriptionProps<T>
> & { class?: string | undefined }

/** Describe the dialog without treating its arbitrary body content as the accessible name. */
export function AlertDialogDescription<T extends ValidComponent = 'p'>(
  props: AlertDialogDescriptionProps<T>,
): JSX.Element {
  return (
    <Primitive.Description<T>
      {...props}
      class={twMerge('m-0 mt-1 font-ui text-xs text-muted-foreground', props.class)}
    />
  )
}
