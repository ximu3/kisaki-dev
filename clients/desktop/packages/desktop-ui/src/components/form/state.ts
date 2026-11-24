import { createMemo, createSignal, flush, type Accessor } from 'solid-js'
import type { FieldIssue } from '../../internal/form'

export interface FormOptions {
  validate?: (() => readonly FieldIssue[]) | undefined
  order?: (() => readonly string[]) | undefined
  locate?: ((id: string) => void) | undefined

  onSubmit: (submitter: HTMLElement | null) => void | Promise<void>
}

type ValidatedControl =
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement
  | HTMLButtonElement

function fieldKey(control: HTMLElement): string | undefined {
  return (
    control.closest<HTMLElement>('[data-field-key]')?.dataset.fieldKey ||
    control.closest<HTMLElement>('[data-control-key]')?.dataset.controlKey ||
    control.id ||
    control.getAttribute('name') ||
    undefined
  )
}

export const formBinding = Symbol('form binding')

export interface FormState {
  busy: Accessor<boolean>
  issues: Accessor<readonly FieldIssue[]>
  activeFieldId: Accessor<string | null>
  message: Accessor<string | undefined>

  submit: (submitter?: HTMLElement | null) => Promise<boolean>
  clear: () => void
  locate: (id: string) => void

  readonly [formBinding]: {
    bind: (element: HTMLFormElement) => () => void
    focus: (target: EventTarget | null) => void
    refresh: () => void
    validating: Accessor<boolean>
  }
}

export function createForm(options: FormOptions): FormState {
  const [node, setNode] = createSignal<HTMLFormElement>()
  const [attempted, setAttempted] = createSignal(false)
  const [revision, setRevision] = createSignal(0)
  const [activeFieldId, setActive] = createSignal<string | null>(null)
  const [message, setMessage] = createSignal<string>()
  const [busy, setBusy] = createSignal(false)
  let pending: Promise<boolean> | undefined

  function bind(element: HTMLFormElement) {
    setNode(element)
    return () => {
      if (node() === element) {
        setNode(undefined)
      }
    }
  }

  function refresh() {
    setRevision((value) => value + 1)
  }

  function inspect(): readonly FieldIssue[] {
    revision()
    if (!attempted()) {
      return []
    }

    const problems = new Map<string, FieldIssue>()
    const nativeOrder: string[] = []
    const controls = node()?.elements
    if (controls) {
      for (const [index, element] of Array.from(controls).entries()) {
        if (!('willValidate' in element) || !element.willValidate) {
          continue
        }
        const control = element as ValidatedControl
        const id = fieldKey(control) ?? '@' + index
        nativeOrder.push(id)
        if (!control.validity.valid && !problems.has(id)) {
          problems.set(id, { id, summary: control.validationMessage })
        }
      }
    }
    for (const issue of options.validate?.() ?? []) {
      problems.set(issue.id, issue)
    }

    const order = new Set([...(options.order?.() ?? nativeOrder), ...problems.keys()])
    return Array.from(order).flatMap((id) => {
      const issue = problems.get(id)
      return issue ? [issue] : []
    })
  }

  const issues = createMemo(inspect)

  function locate(id: string) {
    if (options.locate) {
      options.locate(id)
      return
    }

    const controls = node()?.elements
    if (controls) {
      const targets = Array.from(controls).filter(
        (item, index): item is HTMLElement =>
          item instanceof HTMLElement &&
          !item.matches(':disabled, [tabindex="-1"], input[type="hidden"]') &&
          (fieldKey(item) ?? '@' + index) === id,
      )
      const inputs = targets.filter(
        (item): item is ValidatedControl => 'willValidate' in item && item.willValidate === true,
      )
      const invalid = inputs.find((item) => !item.validity.valid)
      const anchor = targets.find((item) => item.hasAttribute('data-focus-anchor'))
      const target = invalid ?? anchor ?? inputs[0]
      target?.focus()
    }
  }

  function clear() {
    setAttempted(false)
    setActive(null)
    setMessage(undefined)
  }

  function focus(target: EventTarget | null) {
    if (!(target instanceof HTMLElement && target.closest('[data-form-feedback]'))) {
      setActive(target instanceof HTMLElement ? (fieldKey(target) ?? null) : null)
    }
  }

  function submit(submitter: HTMLElement | null = null): Promise<boolean> {
    if (pending) {
      return pending
    }

    const operation = Promise.withResolvers<boolean>()
    pending = operation.promise
    async function run() {
      setMessage(undefined)
      setAttempted(true)
      refresh()

      // Native requestSubmit can follow an input event in the same JavaScript turn.
      flush()
      const first = issues()[0]
      if (first) {
        locate(first.id)
        return false
      }

      setBusy(true)
      await options.onSubmit(submitter)
      clear()
      return true
    }

    function finish() {
      pending = undefined
      setBusy(false)
    }
    void run().then(
      (accepted) => {
        finish()
        operation.resolve(accepted)
      },
      (cause: unknown) => {
        setMessage(cause instanceof Error ? cause.message : String(cause))
        finish()
        operation.reject(cause)
      },
    )
    return operation.promise
  }

  return {
    busy,
    issues,
    activeFieldId,
    message,
    submit,
    locate,
    clear,
    [formBinding]: { bind, focus, refresh, validating: attempted },
  }
}
