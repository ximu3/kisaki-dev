/** @fileoverview Connects labels, stable descriptions and reported errors to a native control. */

import { children, createUniqueId, Show, splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Spread these reactive attributes onto the labelable control inside the field. */
export interface FieldControl {
  readonly id: string
  readonly 'aria-describedby': string | undefined
  readonly 'aria-invalid': boolean
  readonly 'aria-errormessage': string | undefined
}

export interface FieldProps {
  id?: string
  label: JSX.Element
  description?: JSX.Element
  /** Exposed to assistive technology without changing the visible form layout. */
  error?: string | undefined
  class?: string
  children: (attributes: FieldControl) => JSX.Element
}

/** Keep the label, help text and validation message associated across updates. */
export function Field(props: FieldProps): JSX.Element {
  const generated = createUniqueId()
  const description = children(() => props.description)
  const control: FieldControl = {
    get id() {
      return props.id ?? generated
    },
    get 'aria-describedby'() {
      return description() ? control.id + '-help' : undefined
    },
    get 'aria-invalid'() {
      return !!props.error
    },
    get 'aria-errormessage'() {
      return props.error ? control.id + '-error' : undefined
    },
  }
  return (
    <div class={twMerge('grid min-w-0 gap-1', props.class)}>
      <label for={control.id} class="text-sm font-medium">
        {props.label}
      </label>
      {props.children(control)}
      <Show when={description()}>
        <div id={control.id + '-help'} class="text-xs text-muted-foreground">
          {description()}
        </div>
      </Show>
      <Show when={props.error}>
        <span id={control.id + '-error'} class="sr-only">
          {props.error}
        </span>
      </Show>
    </div>
  )
}

/** Native grouping, including form ownership and disabled fieldset behavior. */
export function FieldGroup(
  props: JSX.FieldsetHTMLAttributes<HTMLFieldSetElement> & { legend: JSX.Element },
): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'legend', 'children'])

  return (
    <fieldset {...rest} class={twMerge('ks-box grid min-w-0 gap-3 p-0', local.class)}>
      <legend class="mb-2 text-sm font-semibold">{local.legend}</legend>
      {local.children}
    </fieldset>
  )
}
