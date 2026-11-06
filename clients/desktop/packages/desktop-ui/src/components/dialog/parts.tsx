/** @fileoverview Native modal dialogs with cancelable close requests and local content lifetime. */

import {
  createContext,
  createEffect,
  createSignal,
  createUniqueId,
  onCleanup,
  onMount,
  Show,
  splitProps,
  useContext,
} from 'solid-js'
import type { Accessor, JSX, ParentProps } from 'solid-js'
import { assignRef, callHandler, classes } from '../../internal/dom'
import { createValue } from '../../internal/state'
import { registerModal } from '../../internal/modal-host'
import { Button } from '../button/control'
import type { ButtonProps } from '../button/control'
import styles from './styles.module.css'

interface DialogState {
  id: string
  node: HTMLDialogElement | undefined

  open: Accessor<boolean>
  change: (open: boolean) => void

  description: Accessor<boolean>
  setDescription: (value: boolean) => void
}

const DialogContext = createContext<DialogState>()

/** Controlled open changes must be adopted by the caller; defaultOpen initializes local state. */
export interface DialogProps extends ParentProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

/** Establish a local modal owner. Closing content ends child resources; opening creates new children. */
export function Dialog(props: DialogProps): JSX.Element {
  const [description, setDescription] = createSignal(false)
  const [open, change] = createValue(
    () => props.open,
    () => props.defaultOpen ?? false,
    (next) => props.onOpenChange?.(next),
  )

  return (
    <DialogContext.Provider
      value={{ id: createUniqueId(), open, change, node: undefined, description, setDescription }}
    >
      {props.children}
    </DialogContext.Provider>
  )
}

/** Native action trigger; focus restoration is handled by the dialog's showModal/close cycle. */
export function DialogTrigger(props: ButtonProps): JSX.Element {
  const dialog = useDialog()
  const [local, rest] = splitProps(props, ['onClick'])

  return (
    <Button
      {...rest}
      aria-haspopup="dialog"
      aria-expanded={dialog.open()}
      aria-controls={dialog.id}
      onClick={(event) => {
        callHandler(local.onClick, event)
        if (!event.defaultPrevented) {
          dialog.change(true)
        }
      }}
    />
  )
}

/** Prevent onCloseRequest's native cancel event to keep editing. Persistence and confirmation belong to the caller. */
export interface DialogContentProps extends Omit<
  JSX.DialogHtmlAttributes<HTMLDialogElement>,
  'open'
> {
  onCloseRequest?: (event: Event) => void
  closeOnOutside?: boolean
}

/** Enter the browser's modal top layer. Supply DialogTitle or an explicit aria-label. */
export function DialogContent(props: DialogContentProps): JSX.Element {
  const dialog = useDialog()
  const [local, rest] = splitProps(props, [
    'children',
    'class',
    'ref',
    'onCancel',
    'onClose',
    'onCloseRequest',
    'closeOnOutside',
  ])

  let node!: HTMLDialogElement
  let releaseModal: (() => void) | undefined
  const release = () => {
    releaseModal?.()
    releaseModal = undefined
  }
  onMount(() => {
    dialog.node = node
    createEffect(() => {
      if (dialog.open() && !node.open) {
        node.showModal()
        releaseModal = registerModal(node)
      } else if (!dialog.open() && node.open) {
        release()
        node.close()
      }
    })
    onCleanup(() => {
      dialog.node = undefined
      release()
      if (node.open) {
        node.close()
      }
    })
  })

  return (
    <dialog
      {...rest}
      id={dialog.id}
      ref={(element) => {
        node = element
        assignRef(local.ref, element)
      }}
      aria-labelledby={
        props['aria-labelledby'] ?? (props['aria-label'] ? undefined : `${dialog.id}-title`)
      }
      aria-describedby={
        props['aria-describedby'] ?? (dialog.description() ? `${dialog.id}-description` : undefined)
      }
      class={classes(styles.root, local.class)}
      closedby={local.closeOnOutside ? 'any' : 'closerequest'}
      onCancel={(event) => {
        callHandler(local.onCancel, event)
        if (!event.defaultPrevented) {
          local.onCloseRequest?.(event)
        }
      }}
      onClose={(event) => {
        if (!node.open) {
          release()
          dialog.change(false)
        }
        callHandler(local.onClose, event)
      }}
    >
      <Show when={dialog.open()}>{local.children}</Show>
    </dialog>
  )
}

/** Request a native cancelable close; do not use it to perform asynchronous saving. */
export function DialogClose(props: ButtonProps): JSX.Element {
  const dialog = useDialog()
  const [local, rest] = splitProps(props, ['onClick'])

  return (
    <Button
      variant="outline"
      {...rest}
      onClick={(event) => {
        callHandler(local.onClick, event)
        if (!event.defaultPrevented) {
          dialog.node?.requestClose()
        }
      }}
    />
  )
}

/** Fixed heading area, separated from the scrollable body in ordinary dialogs. */
export function DialogHeader(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <div {...rest} class={classes(styles.header, local.class)} />
}

/** Accessible modal heading, linked by DialogContent. */
export function DialogTitle(props: JSX.HTMLAttributes<HTMLHeadingElement>): JSX.Element {
  const dialog = useDialog()
  const [local, rest] = splitProps(props, ['class'])

  return <h2 {...rest} id={`${dialog.id}-title`} class={classes(styles.title, local.class)} />
}

/** An optional whole-dialog description, automatically associated while mounted. */
export function DialogDescription(props: JSX.HTMLAttributes<HTMLParagraphElement>): JSX.Element {
  const dialog = useDialog()
  const [local, rest] = splitProps(props, ['class'])
  dialog.setDescription(true)
  onCleanup(() => dialog.setDescription(false))

  return (
    <p {...rest} id={`${dialog.id}-description`} class={classes(styles.description, local.class)} />
  )
}

/** Scrollable content leaves the footer available at small window sizes. */
export function DialogBody(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <div {...rest} class={classes(styles.body, local.class)} />
}

/** Action layout; caller selects submit/cancel actions and their accessible names. */
export function DialogFooter(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <div {...rest} class={classes(styles.footer, local.class)} />
}

/** Confirmation content uses the same local dialog owner and native cancel path. */
export function AlertDialogContent(props: DialogContentProps): JSX.Element {
  return <DialogContent {...props} role="alertdialog" />
}

/** Require the nearest dialog rather than sharing state across windows or nested dialogs. */
function useDialog(): DialogState {
  const dialog = useContext(DialogContext)
  if (!dialog) {
    throw new Error('Dialog parts require Dialog.')
  }

  return dialog
}
