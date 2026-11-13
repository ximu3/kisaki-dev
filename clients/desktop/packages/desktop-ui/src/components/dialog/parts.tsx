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
import { Icon, X } from '../../internal/icon/glyph'
import { createValue } from '../../internal/state'
import { registerModal } from '../../internal/modal-host'
import { createPresentation } from '../../internal/popup/presentation'
import { Button } from '../button/control'
import type { ButtonProps } from '../button/control'
import surface from '../../internal/popup/surface.module.css'
import styles from './styles.module.css'

/** Local dialog identity, native element and shared open and description state. */
interface DialogState {
  id: string
  node: HTMLDialogElement | undefined

  /** Reads the current controlled or locally owned open value. */
  open: Accessor<boolean>
  /** Requests an open-state change through the dialog's value owner. */
  change: (open: boolean) => void

  /** Reads whether the dialog description is currently mounted. */
  description: Accessor<boolean>
  /** Updates description presence for the dialog's accessible association. */
  setDescription: (value: boolean) => void
}

const DialogContext = createContext<DialogState>()

/**
 * Dialog composition with controlled or locally initialized open state.
 *
 * Controlled requests require caller adoption; defaultOpen initializes local state.
 */
export interface DialogProps extends ParentProps {
  open?: boolean
  defaultOpen?: boolean
  /** Reports the requested open state to the caller. */
  onOpenChange?: (open: boolean) => void
}

/** Establishes local state and identity for one modal composition. */
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

/** Renders an action button that requests opening the associated native dialog. */
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

/**
 * Native modal content attributes with cancelable close requests and optional outside dismissal.
 *
 * The caller owns persistence and any confirmation before closing.
 */
export interface DialogContentProps extends Omit<
  JSX.DialogHtmlAttributes<HTMLDialogElement>,
  'open'
> {
  /** Receives an unprevented native cancel event; preventDefault keeps the dialog open. */
  onCloseRequest?: (event: Event) => void
  closeOnOutside?: boolean
}

/**
 * Presents content in the browser's modal top layer and retains children through exit presentation.
 *
 * Callers supply DialogTitle or an explicit accessible label.
 */
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
  const present = createPresentation(dialog.open, () => node)
  let releaseModal: (() => void) | undefined
  /** Releases this dialog's modal registration and clears the owned handle. */
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
      class={classes(surface.modal, styles.root, local.class)}
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
      <Show when={present()}>
        <div class={classes(surface.viewport, styles.content)}>{local.children}</div>
      </Show>
    </dialog>
  )
}

/**
 * Renders an action that requests the native cancelable close path.
 *
 * Asynchronous saving belongs to the caller's close coordination.
 */
export function DialogClose(props: ButtonProps): JSX.Element {
  const dialog = useDialog()
  const [local, rest] = splitProps(props, ['onClick'])

  return (
    <Button
      variant="secondary"
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

/** Header attributes with an optional localized accessible label for an exit button. */
export interface DialogHeaderProps extends JSX.HTMLAttributes<HTMLDivElement> {
  closeLabel?: string
}

/** Renders the dialog heading area and an optional exit using the shared cancelable close path. */
export function DialogHeader(props: DialogHeaderProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'children', 'closeLabel'])

  return (
    <div {...rest} class={classes(styles.header, surface.withClose, local.class)}>
      {local.children}
      <Show when={local.closeLabel}>
        {(label) => (
          <DialogClose
            type="button"
            variant="ghost"
            size="icon"
            class={surface.close}
            aria-label={label()}
          >
            <Icon icon={X} />
          </DialogClose>
        )}
      </Show>
    </div>
  )
}

/** Renders a modal heading linked to DialogContent through the local dialog identity. */
export function DialogTitle(props: JSX.HTMLAttributes<HTMLHeadingElement>): JSX.Element {
  const dialog = useDialog()
  const [local, rest] = splitProps(props, ['class'])

  return <h2 {...rest} id={`${dialog.id}-title`} class={classes(styles.title, local.class)} />
}

/** Renders a whole-dialog description and maintains its accessible association while mounted. */
export function DialogDescription(props: JSX.HTMLAttributes<HTMLParagraphElement>): JSX.Element {
  const dialog = useDialog()
  const [local, rest] = splitProps(props, ['class'])
  dialog.setDescription(true)
  onCleanup(() => dialog.setDescription(false))

  return (
    <p {...rest} id={`${dialog.id}-description`} class={classes(styles.description, local.class)} />
  )
}

/** Renders a scrollable content area that leaves dialog actions available at small window sizes. */
export function DialogBody(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <div {...rest} class={classes(styles.body, local.class)} />
}

/** Lays out caller-owned dialog actions and their accessible labels. */
export function DialogFooter(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <div {...rest} class={classes(styles.footer, local.class)} />
}

/**
 * Renders confirmation content with alertdialog semantics and the same native close coordination.
 */
export function AlertDialogContent(props: DialogContentProps): JSX.Element {
  return <DialogContent {...props} role="alertdialog" />
}

/** Returns the nearest dialog state and rejects parts rendered outside a Dialog owner. */
function useDialog(): DialogState {
  const dialog = useContext(DialogContext)
  if (!dialog) {
    throw new Error('Dialog parts require Dialog.')
  }

  return dialog
}
