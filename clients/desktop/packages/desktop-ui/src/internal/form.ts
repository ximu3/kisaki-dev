/** @fileoverview Shares a mounted form's field issues and focus with field and feedback parts. */

import { createContext, createSignal } from 'solid-js'
import type { Accessor } from 'solid-js'

/** Correction associated with a stable field identity in the complete edit. */
export interface FieldIssue {
  readonly id: string
  readonly summary: string
  readonly message?: string
}

/** Live feedback supplied to controls inside one form instance. */
export interface FormFeedbackState {
  issues: Accessor<readonly FieldIssue[]>
  activeFieldId: Accessor<string | null>
  message: Accessor<string | undefined>
  locate: (id: string) => void
}

/** Separates each form's validation and feedback from other mounted editors. */
export const FormContext = createContext<FormFeedbackState>()

/** Native controls whose form owner supplies feedback to their enclosing Field. */
const fieldControls = 'input,select,textarea,fieldset,button'

/** One document's validating forms and the native membership changes they share. */
function createFormRegistry() {
  const owners = new Map<HTMLFormElement, { feedback: FormFeedbackState; refresh: () => void }>()
  const [membership, setMembership] = createSignal(0)
  const changed = () => setMembership((version) => version + 1)

  const members = 'form,option,' + fieldControls
  const observer = new MutationObserver((records) => {
    const membershipChanged = records.some((record) =>
      record.type === 'attributes'
        ? record.attributeName === 'form' || record.attributeName === 'id'
        : [...record.addedNodes, ...record.removedNodes].some(
            (node) =>
              node instanceof Element && (node.matches(members) || !!node.querySelector(members)),
          ),
    )
    if (membershipChanged || records.some((record) => record.type === 'attributes')) {
      for (const owner of owners.values()) {
        owner.refresh()
      }
    }
    if (membershipChanged) {
      changed()
    }
  })
  return { owners, membership, changed, observer }
}

/** Native form lookup and observation are local to the owning document. */
const registries = new WeakMap<Document, ReturnType<typeof createFormRegistry>>()

/** Supplies the same registry to forms and to fields mounted outside their form. */
function registryFor(doc: Document) {
  let registry = registries.get(doc)
  if (!registry) {
    registry = createFormRegistry()
    registries.set(doc, registry)
  }
  return registry
}

/** Reads feedback from the control's native form, including explicit HTML form associations. */
export function fieldForm(
  field: HTMLElement,
  id: string,
  inherited: FormFeedbackState | undefined,
): FormFeedbackState | undefined {
  const registry = registryFor(field.ownerDocument)
  registry.membership()
  if (!registry.owners.size) {
    return undefined
  }

  const controls = Array.from(
    field.querySelectorAll<HTMLElement & { readonly form: HTMLFormElement | null }>(fieldControls),
  ).filter((element) => element.closest('[data-field-key]') === field)
  const control =
    controls.find((element) => element.id === id) ??
    controls.find((element) => element.hasAttribute('form')) ??
    controls[0]
  if (!control) {
    return inherited
  }
  return control.form ? registry.owners.get(control.form)?.feedback : undefined
}

/** Schedules validation after a public control writes a native property or custom validity. */
export function nativeValidityChanged(form: HTMLFormElement | null): void {
  if (form) {
    registries.get(form.ownerDocument)?.owners.get(form)?.refresh()
  }
}

/** Tracks form membership and native constraints, including externally associated controls. */
export function observeValidity(
  form: HTMLFormElement,
  feedback: FormFeedbackState,
  refresh: () => void,
): () => void {
  const registry = registryFor(form.ownerDocument)
  let queued = false
  function schedule() {
    if (!queued) {
      queued = true
      queueMicrotask(() => {
        queued = false
        if (registry.owners.get(form)?.refresh === schedule) {
          refresh()
        }
      })
    }
  }

  if (!registry.owners.size) {
    registry.observer.observe(form.ownerDocument, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        'required',
        'disabled',
        'readonly',
        'pattern',
        'min',
        'max',
        'step',
        'minlength',
        'maxlength',
        'type',
        'multiple',
        'value',
        'checked',
        'selected',
        'form',
        'id',
        'name',
        'data-control-key',
        'data-field-key',
      ],
    })
  }
  registry.owners.set(form, { feedback, refresh: schedule })
  registry.changed()
  return () => {
    registry.owners.delete(form)
    registry.changed()
    if (!registry.owners.size) {
      registry.observer.disconnect()
    }
  }
}
