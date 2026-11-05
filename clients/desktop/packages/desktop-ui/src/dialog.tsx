/** @fileoverview Composable native modal dialogs. The owner decides whether a requested close proceeds. */

import {
  createContext,
  createEffect,
  createSignal,
  createUniqueId,
  onCleanup,
  splitProps,
  useContext,
  type JSX,
} from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { Button, type ButtonProps } from './button'

export interface DialogProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Runs synchronously. Prevent the event to keep editing or ask for confirmation in the host. */
  onCloseRequest?: (event: Event) => void
  children: JSX.Element
}

interface DialogState {
  id: string
  open: () => boolean
  change: (open: boolean) => void
  request: (event: Event) => void
  element?: HTMLDialogElement
}

const context = createContext<DialogState>()

/** Get this part's enclosing modal. */
function useDialog(): DialogState {
  const dialog = useContext(context)
  if (!dialog) {
    throw new Error('Dialog parts require an enclosing Dialog.')
  }
  return dialog
}

/** Own the open state locally or pass open and handle change requests in the host. */
export function Dialog(props: DialogProps): JSX.Element {
  const [draft, setDraft] = createSignal(props.defaultOpen ?? false)
  const state: DialogState = {
    id: createUniqueId(),
    open: () => props.open ?? draft(),
    change(open) {
      if (open !== state.open()) {
        setDraft(open)
        props.onOpenChange?.(open)
      }
    },
    request(event) {
      props.onCloseRequest?.(event)
      if (!event.defaultPrevented) {
        state.change(false)
      }
      event.preventDefault()
    },
  }
  return <context.Provider value={state}>{props.children}</context.Provider>
}

/** Open this modal from a named button. */
export function DialogTrigger(props: ButtonProps): JSX.Element {
  const state = useDialog()

  return (
    <Button
      {...props}
      aria-haspopup="dialog"
      aria-expanded={state.open()}
      aria-controls={state.id}
      on:click={() => state.change(true)}
    />
  )
}

export type DialogContentProps = Omit<JSX.IntrinsicElements['dialog'], 'open' | 'id'>

/** Show in the native top layer. Use DialogTitle or supply aria-label for its accessible name. */
export function DialogContent(props: DialogContentProps): JSX.Element {
  const state = useDialog()
  const [local, rest] = splitProps(props, ['ref', 'class'])
  let dialog!: HTMLDialogElement

  /** Mirror accepted state in the native modal stack. */
  function sync(): void {
    if (state.open() && !dialog.open) {
      dialog.showModal()
    } else if (!state.open() && dialog.open) {
      dialog.close()
    }
  }
  createEffect(sync)
  onCleanup(() => {
    if (dialog.open) {
      dialog.close()
    }
    delete state.element
  })

  return (
    <dialog
      aria-labelledby={props['aria-label'] ? undefined : state.id + '-title'}
      closedby="any"
      {...rest}
      id={state.id}
      ref={(el) => {
        dialog = el
        state.element = el
        if (typeof local.ref === 'function') {
          local.ref(el)
        }
      }}
      on:cancel={state.request}
      on:close={() => {
        if (!dialog.open && state.open()) {
          state.change(false)
          sync()
        }
      }}
      on:submit={(event) => {
        const form = event.target
        if (!(form instanceof HTMLFormElement) || event.defaultPrevented) {
          return
        }
        const method = event.submitter?.getAttribute('formmethod') ?? form.method
        if (method.toLowerCase() === 'dialog') {
          event.preventDefault()
          const submitter = event.submitter
          const value =
            submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement
              ? submitter.value
              : undefined
          dialog.requestClose(value)
          if (!state.open() && value !== undefined) {
            dialog.returnValue = value
          }
        }
      }}
      class={twMerge(
        'ks-dialog ks-box fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(28rem,calc(100vw-2rem))] overflow-auto rounded-lg border border-border bg-dialog p-4 text-dialog-foreground shadow-modal',
        local.class,
      )}
    />
  )
}

/** Supply the heading referenced by the containing dialog. */
export function DialogTitle(props: JSX.HTMLAttributes<HTMLHeadingElement>): JSX.Element {
  const state = useDialog()

  return (
    <h2
      {...props}
      id={state.id + '-title'}
      class={twMerge('m-0 mb-2 text-base font-semibold', props.class)}
    />
  )
}

/** Request the same cancelable close as Escape or light dismissal. */
export function DialogClose(props: ButtonProps): JSX.Element {
  const state = useDialog()
  return <Button {...props} on:click={() => state.element?.requestClose()} />
}

/** Present a named, modal decision. The caller supplies actions and their effects. */
export function AlertDialogContent(props: DialogContentProps): JSX.Element {
  return <DialogContent {...props} role="alertdialog" closedby="closerequest" />
}
