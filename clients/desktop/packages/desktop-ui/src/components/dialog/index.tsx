import {
  createContext,
  createEffect,
  createSignal,
  createUniqueId,
  flush,
  onCleanup,
  onSettled,
  Show,
  omit,
  useContext,
  type Accessor,
  type ParentProps,
} from 'solid-js'
import type { JSX } from '@solidjs/web'
import { callHandler } from '../../internal/dom'
import { mdiClose } from '@mdi/js'
import { Icon } from '../icon'
import { createValue } from '../../internal/state'
import { registerModal } from '../../internal/modal-host'
import { createPresentation } from '../../internal/popup/presentation'
import { Button, type ButtonProps } from '../button'
import surface from '../../internal/popup/surface.module.css'
import styles from './styles.module.css'

interface DialogState {
  id: string
  node: HTMLDialogElement | undefined

  open: Accessor<boolean>
  change: (open: boolean) => void

  description: Accessor<boolean>
  setDescription: (value: boolean) => void

  ready: Accessor<boolean>
  addReadiness: (ready: Accessor<boolean>) => () => void
}

const DialogContext = createContext<DialogState>()

export interface DialogProps extends ParentProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export function Dialog(props: DialogProps): JSX.Element {
  const [description, setDescription] = createSignal(false)
  const [readiness, setReadiness] = createSignal<readonly Accessor<boolean>[]>([], {
    ownedWrite: true,
  })
  const [open, change] = createValue(
    () => props.open,
    () => props.defaultOpen ?? false,
    (next) => props.onOpenChange?.(next),
  )

  function addReadiness(ready: Accessor<boolean>) {
    setReadiness((checks) => [...checks, ready])
    return () => setReadiness((checks) => checks.filter((check) => check !== ready))
  }

  return (
    <DialogContext
      value={{
        id: createUniqueId(),
        open,
        change,
        node: undefined,
        description,
        setDescription,
        ready: () => readiness().every((check) => check()),
        addReadiness,
      }}
    >
      {props.children}
    </DialogContext>
  )
}

export function deferDialogUntil(ready: Accessor<boolean>): void {
  const unregister = useContext(DialogContext).addReadiness(ready)
  onCleanup(unregister)
}

export function DialogTrigger(props: ButtonProps): JSX.Element {
  const dialog = useContext(DialogContext)
  const rest = omit(props, 'onClick')

  return (
    <Button
      {...rest}
      aria-haspopup="dialog"
      aria-expanded={dialog.open() ? 'true' : 'false'}
      aria-controls={dialog.id}
      onClick={(event) => {
        callHandler(props.onClick, event)
        if (!event.defaultPrevented) {
          dialog.change(true)
        }
      }}
    />
  )
}

export interface DialogContentProps extends Omit<
  JSX.DialogHtmlAttributes<HTMLDialogElement>,
  'open'
> {
  onCloseRequest?: (event: Event) => void
  closeOnOutside?: boolean

  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  fill?: boolean
}

export function DialogContent(props: DialogContentProps): JSX.Element {
  const dialog = useContext(DialogContext)
  const rest = omit(
    props,
    'children',
    'class',
    'ref',
    'onCancel',
    'onClose',
    'onCloseRequest',
    'closeOnOutside',
    'size',
    'fill',
  )

  let node!: HTMLDialogElement
  const present = createPresentation(dialog.open, () => node)
  let releaseModal: (() => void) | undefined
  let activated = false

  const release = () => {
    releaseModal?.()
    releaseModal = undefined
  }

  function show() {
    node.showModal()
    activated = true
    releaseModal = registerModal(node)
  }

  onSettled(() => {
    dialog.node = node
    return () => {
      dialog.node = undefined
      if (node.open) {
        node.close()
      }
      release()
    }
  })

  createEffect(
    () => [dialog.open(), dialog.ready()],
    ([open, ready]) => {
      if (!open) {
        activated = false
        if (node.open) {
          node.close()
          release()
        }
      } else if (!activated && ready) {
        show()
      }
    },
  )

  return (
    <dialog
      {...rest}
      id={dialog.id}
      ref={[
        (element) => {
          node = element
        },
        props.ref,
      ]}
      aria-labelledby={
        props['aria-labelledby'] ?? (props['aria-label'] ? undefined : `${dialog.id}-title`)
      }
      aria-describedby={
        props['aria-describedby'] ?? (dialog.description() ? `${dialog.id}-description` : undefined)
      }
      class={[surface.modal, styles.root, props.class]}
      data-size={props.size ?? 'md'}
      data-fill={props.fill || undefined}
      closedby={props.closeOnOutside ? 'any' : 'closerequest'}
      onCancel={(event) => {
        callHandler(props.onCancel, event)
        if (!event.defaultPrevented) {
          props.onCloseRequest?.(event)
        }
        if (!event.defaultPrevented) {
          event.preventDefault()
          dialog.change(false)
        }
      }}
      onClose={(event) => {
        // Closing during disposal can deliver a native event after the next editor has opened.
        if (dialog.node !== node) {
          return
        }
        if (!node.open) {
          release()
          if (dialog.open()) {
            dialog.change(false)
            // The native close has already completed. Settle the owner before deciding to reopen.
            flush()
            if (dialog.node === node && dialog.open() && !node.open) {
              show()
            }
          }
        }
        callHandler(props.onClose, event)
      }}
    >
      <Show when={present()}>
        <div class={[surface.viewport, styles.content]}>{props.children}</div>
      </Show>
    </dialog>
  )
}

export function DialogClose(props: ButtonProps): JSX.Element {
  const dialog = useContext(DialogContext)
  const rest = omit(props, 'onClick')

  return (
    <Button
      variant="secondary"
      {...rest}
      onClick={(event) => {
        callHandler(props.onClick, event)
        if (!event.defaultPrevented) {
          dialog.node?.requestClose()
        }
      }}
    />
  )
}

export interface DialogHeaderProps extends JSX.HTMLAttributes<HTMLDivElement> {
  closeLabel?: string
}

export function DialogHeader(props: DialogHeaderProps): JSX.Element {
  const rest = omit(props, 'class', 'children', 'closeLabel')

  return (
    <div {...rest} class={[styles.header, surface.withClose, props.class]}>
      {props.children}
      <Show when={props.closeLabel}>
        {(label) => (
          <DialogClose
            type="button"
            variant="ghost"
            size="icon"
            class={surface.close}
            aria-label={label()}
          >
            <Icon path={mdiClose} />
          </DialogClose>
        )}
      </Show>
    </div>
  )
}

export function DialogTitle(props: JSX.HTMLAttributes<HTMLHeadingElement>): JSX.Element {
  const dialog = useContext(DialogContext)
  const rest = omit(props, 'class')

  return <h2 {...rest} id={`${dialog.id}-title`} class={[styles.title, props.class]} />
}

export function DialogDescription(props: JSX.HTMLAttributes<HTMLParagraphElement>): JSX.Element {
  const dialog = useContext(DialogContext)
  const rest = omit(props, 'class')
  onSettled(() => {
    dialog.setDescription(true)
    return () => dialog.setDescription(false)
  })

  return <p {...rest} id={`${dialog.id}-description`} class={[styles.description, props.class]} />
}

export function DialogBody(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const rest = omit(props, 'class')

  return <div {...rest} class={[styles.body, props.class]} />
}

export function DialogFooter(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const rest = omit(props, 'class')

  return <div {...rest} class={[styles.footer, props.class]} />
}

export function AlertDialogContent(props: DialogContentProps): JSX.Element {
  return <DialogContent size="sm" {...props} role="alertdialog" />
}
