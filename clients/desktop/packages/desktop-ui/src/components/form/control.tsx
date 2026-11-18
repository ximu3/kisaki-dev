/** @fileoverview Binds the native form and its submitter to an editor's asynchronous operation. */

import { onCleanup, onMount, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, classes } from '../../internal/dom'
import { FormContext } from '../../internal/form'
import { createForm, formBinding } from './state'
import type { FormOptions, FormState } from './state'
import styles from './styles.module.css'

/** Native form attributes with callbacks or an instance held by the owning editor. */
export type FormProps = Omit<JSX.FormHTMLAttributes<HTMLFormElement>, 'onSubmit' | 'novalidate'> &
  (
    | (FormOptions & { state?: never })
    | { state: FormState; validate?: never; order?: never; locate?: never; onSubmit?: never }
  )

/** Keeps native form semantics and routes each submission through one validation and save path. */
export function Form(props: FormProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'state',
    'validate',
    'order',
    'locate',
    'onSubmit',
    'ref',
    'class',
    'children',
  ])
  const form = props.state ?? createForm(props)
  const binding = form[formBinding]
  let element!: HTMLFormElement

  onMount(() => {
    const doc = element.ownerDocument
    function belongs(target: EventTarget | null) {
      return (
        target instanceof HTMLElement &&
        (element.contains(target) || ('form' in target && target.form === element))
      )
    }
    function changed(event: Event) {
      if (belongs(event.target)) {
        queueMicrotask(binding.refresh)
      }
    }
    function focused(event: FocusEvent) {
      if (belongs(event.target)) {
        binding.focus(event.target)
      }
    }
    function reset(event: Event) {
      if (event.target === element) {
        queueMicrotask(() => {
          if (!event.defaultPrevented) {
            form.clear()
          }
        })
      }
    }

    doc.addEventListener('focusin', focused)
    doc.addEventListener('input', changed)
    doc.addEventListener('change', changed)
    doc.addEventListener('reset', reset)
    onCleanup(() => {
      doc.removeEventListener('focusin', focused)
      doc.removeEventListener('input', changed)
      doc.removeEventListener('change', changed)
      doc.removeEventListener('reset', reset)
      binding.bind(undefined)
    })
  })

  return (
    <FormContext.Provider value={{ ...form, refresh: binding.refresh }}>
      <form
        {...rest}
        ref={(value) => {
          element = value
          binding.bind(value)
          assignRef(local.ref, value)
        }}
        class={classes(styles.root, local.class)}
        novalidate
        onSubmit={(event) => {
          event.preventDefault()
          // The instance retains the failure for FormFeedback. Imperative callers receive the rejection.
          void form.submit(event.submitter).catch(() => {})
        }}
      >
        {local.children}
      </form>
    </FormContext.Provider>
  )
}
