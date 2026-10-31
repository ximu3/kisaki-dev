/** @fileoverview Owns themed dialog composition, controlled opening, focus restoration, and close requests. */

import * as Primitive from '@kobalte/core/dialog'
import { splitProps, type JSX } from 'solid-js'

/** One dialog owner. Modal dialogs trap focus and make outside content inert; modal defaults to true. */
export interface DialogProps {
  readonly children?: JSX.Element
  readonly open?: boolean
  readonly defaultOpen?: boolean
  readonly onOpenChange?: (open: boolean) => void
  readonly id?: string
  readonly modal?: boolean
}

/** Own the dialog's visibility and descendant associations within the current Solid owner. */
export function Dialog(props: DialogProps): JSX.Element {
  return <Primitive.Root {...props} />
}

/** Open this dialog with a native themed button and retain it as the return-focus target. */
export function DialogTrigger(props: JSX.ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'type', 'ref', 'onClick'])
  return (
    <Primitive.Trigger
      as="button"
      type={local.type ?? 'button'}
      class={`kisaki-button ${local.class ?? ''}`}
      {...rest}
      {...(local.ref === undefined ? {} : { ref: local.ref })}
      {...(local.onClick === undefined ? {} : { onClick: local.onClick })}
    />
  )
}

/** Request closure from a native button; a controlled owner decides when to change its open value. */
export function DialogClose(props: JSX.ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'type', 'ref', 'onClick', 'aria-label'])
  return (
    <Primitive.CloseButton
      as="button"
      type={local.type ?? 'button'}
      class={`kisaki-button ${local.class ?? ''}`}
      {...rest}
      {...(local.ref === undefined ? {} : { ref: local.ref })}
      {...(local.onClick === undefined ? {} : { onClick: local.onClick })}
      {...(local['aria-label'] === undefined ? {} : { 'aria-label': local['aria-label'] })}
    />
  )
}

/** The dismissal cause is local UI intent. preventDefault must be called synchronously before awaiting a draft decision. */
export interface DialogCloseRequest {
  readonly reason: 'escape' | 'outside'
  preventDefault(): void
}
/** Native surface attributes with explicit focus and dismissal coordination owned by the calling view. */
export type DialogContentProps = JSX.HTMLAttributes<HTMLDivElement> & {
  readonly onCloseRequest?: (request: DialogCloseRequest) => void
  readonly onOpenAutoFocus?: (event: Event) => void
  readonly onCloseAutoFocus?: (event: Event) => void
}

/** Portal one surface; required naming comes from DialogTitle. Dismissal can be prevented without discarding a draft. */
export function DialogContent(props: DialogContentProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'class',
    'children',
    'id',
    'ref',
    'onCloseRequest',
    'onOpenAutoFocus',
    'onCloseAutoFocus',
  ])
  return (
    <Primitive.Portal>
      <Primitive.Overlay class="kisaki-dialog-overlay" />
      <Primitive.Content
        as="div"
        class={`kisaki-dialog ${local.class ?? ''}`}
        onOpenAutoFocus={(event) => local.onOpenAutoFocus?.(event)}
        onCloseAutoFocus={(event) => local.onCloseAutoFocus?.(event)}
        onEscapeKeyDown={(event) =>
          local.onCloseRequest?.({ reason: 'escape', preventDefault: () => event.preventDefault() })
        }
        onInteractOutside={(event) =>
          local.onCloseRequest?.({
            reason: 'outside',
            preventDefault: () => event.preventDefault(),
          })
        }
        {...rest}
        {...(local.id === undefined ? {} : { id: local.id })}
        {...(local.ref === undefined ? {} : { ref: local.ref })}
      >
        {local.children}
      </Primitive.Content>
    </Primitive.Portal>
  )
}

/** Name the dialog with a real heading, preserving its accessible relationship to the surface. */
export function DialogTitle(props: JSX.HTMLAttributes<HTMLHeadingElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'id'])
  return (
    <Primitive.Title
      as="h2"
      class={`kisaki-dialog-title ${local.class ?? ''}`}
      {...rest}
      {...(local.id === undefined ? {} : { id: local.id })}
    />
  )
}

/** Associate optional descriptive text with the dialog without treating arbitrary content as its name. */
export function DialogDescription(props: JSX.HTMLAttributes<HTMLParagraphElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'id'])
  return (
    <Primitive.Description
      as="p"
      class={`kisaki-dialog-description ${local.class ?? ''}`}
      {...rest}
      {...(local.id === undefined ? {} : { id: local.id })}
    />
  )
}
