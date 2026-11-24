import { flush, createEffect, createMemo, onSettled, omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { FormContext, nativeValidityChanged, observeValidity } from '../../internal/form'
import { createForm, formBinding, type FormOptions, type FormState } from './state'
import styles from './styles.module.css'

export type FormProps = Omit<JSX.FormHTMLAttributes<HTMLFormElement>, 'onSubmit' | 'novalidate'> &
  (
    | (FormOptions & { state?: never })
    | { state: FormState; validate?: never; order?: never; locate?: never; onSubmit?: never }
  )

export function Form(props: FormProps): JSX.Element {
  const rest = omit(
    props,
    'state',
    'validate',
    'order',
    'locate',
    'onSubmit',
    'ref',
    'class',
    'children',
  )
  const form = createMemo(() => props.state ?? createForm(props))
  let element!: HTMLFormElement

  onSettled(() => {
    const doc = element.ownerDocument

    function belongs(target: EventTarget | null) {
      return (
        target instanceof HTMLElement &&
        ('form' in target ? target.form === element : target.closest('form') === element)
      )
    }

    function changed(event: Event) {
      if (belongs(event.target)) {
        nativeValidityChanged(element)
      }
    }

    function focused(event: FocusEvent) {
      form()[formBinding].focus(belongs(event.target) ? event.target : null)
    }

    function blurred(event: FocusEvent) {
      if (!event.relatedTarget && belongs(event.target)) {
        form()[formBinding].focus(null)
      }
    }

    function reset(event: Event) {
      if (event.target === element) {
        const owner = form()
        queueMicrotask(() => {
          if (!event.defaultPrevented) {
            owner.clear()
          }
        })
      }
    }

    const listeners = new AbortController()
    const options = { signal: listeners.signal }
    doc.addEventListener('focusin', focused, options)
    doc.addEventListener('focusout', blurred, options)
    doc.addEventListener('input', changed, options)
    doc.addEventListener('change', changed, options)
    doc.addEventListener('reset', reset, options)
    return () => listeners.abort()
  })

  createEffect(
    () => form()[formBinding],
    (binding) => {
      return binding.bind(element)
    },
  )

  createEffect(
    () => (form()[formBinding].validating() ? form() : undefined),
    (owner) => {
      if (owner) {
        return observeValidity(element, owner, owner[formBinding].refresh)
      }
    },
  )

  return (
    <FormContext
      value={{
        issues: () => form().issues(),
        activeFieldId: () => form().activeFieldId(),
        message: () => form().message(),
        locate: (id) => form().locate(id),
      }}
    >
      <form
        {...rest}
        ref={[
          (value) => {
            element = value
          },
          props.ref,
        ]}
        class={[styles.root, props.class]}
        novalidate
        onSubmit={(event) => {
          event.preventDefault()
          flush()
          // The instance retains the failure for FormFeedback. Imperative callers receive the rejection.
          void form()
            .submit(event.submitter)
            .catch(() => {})
        }}
      >
        {props.children}
      </form>
    </FormContext>
  )
}
