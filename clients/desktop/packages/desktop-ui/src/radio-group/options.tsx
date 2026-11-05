/** @fileoverview Native radio groups, including fieldset disabling, arrow keys and required submission. */

import {
  createEffect,
  createSignal,
  For,
  createRenderEffect,
  onCleanup,
  onMount,
  splitProps,
  type JSX,
} from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { afterEvent } from '../dom-events'
import { onFormReset } from '../form/native'
import type { SelectOption } from '../select'

export interface RadioGroupProps extends Omit<
  JSX.FieldsetHTMLAttributes<HTMLFieldSetElement>,
  'children' | 'name'
> {
  name: string
  legend: JSX.Element
  options: readonly SelectOption[]
  value?: string | null | undefined
  defaultValue?: string
  required?: boolean
  onValueChange?: (value: string | null) => void
}

/** One fieldset and one radio name own the selection presented in either layout. */
export function RadioChoices(props: RadioGroupProps & { segmented?: boolean }): JSX.Element {
  const [local, rest] = splitProps(props, [
    'class',
    'ref',
    'name',
    'legend',
    'options',
    'value',
    'defaultValue',
    'required',
    'onValueChange',
    'segmented',
  ])
  let group!: HTMLFieldSetElement
  const [draft, setDraft] = createSignal<string | null>(local.defaultValue ?? null)
  const controls = new Map<SelectOption, HTMLInputElement>()

  /** Match each mounted native radio to the active, enabled value. */
  function sync(): void {
    const selected = local.value === undefined ? draft() : local.value
    for (const option of local.options) {
      const input = controls.get(option)
      if (input) {
        input.checked = !option.disabled && option.value === selected
      }
    }
  }
  const settle = afterEvent(sync)

  /** Notify the owner after an edit or native form reset. */
  function changed(): void {
    const selected =
      local.options.find((option) => !option.disabled && controls.get(option)?.checked)?.value ??
      null
    if (local.value === undefined) {
      setDraft(selected)
    } else {
      settle()
    }
    local.onValueChange?.(selected)
  }
  createEffect(sync)
  onMount(() => onFormReset(group, changed))
  return (
    <fieldset
      {...rest}
      ref={(el) => {
        group = el
        if (typeof local.ref === 'function') {
          local.ref(el)
        }
      }}
      class={twMerge('ks-box min-w-0 p-0', local.class)}
    >
      <legend class="mb-1 text-sm font-medium">{local.legend}</legend>
      <div class={local.segmented ? 'inline-flex gap-px rounded-md bg-muted p-0.5' : 'grid gap-1'}>
        <For each={local.options}>
          {(option) => (
            <label
              class={
                local.segmented
                  ? 'ks-box relative inline-flex cursor-pointer items-center rounded-sm px-2 py-1 text-xs text-muted-foreground has-checked:bg-surface has-checked:text-foreground has-checked:shadow-raised has-focus-visible:outline-2 has-focus-visible:outline-ring has-disabled:opacity-50'
                  : 'inline-flex items-center gap-2 text-sm has-disabled:opacity-50'
              }
            >
              <input
                type="radio"
                class={local.segmented ? 'sr-only' : 'ks-focus m-0 size-4 accent-primary'}
                name={local.name}
                form={rest.form}
                value={option.value}
                disabled={option.disabled}
                ref={(el) => {
                  controls.set(option, el)
                  createRenderEffect(() => {
                    el.defaultChecked = !option.disabled && local.defaultValue === option.value
                  })
                  onCleanup(() => controls.delete(option))
                }}
                required={local.required}
                on:change={changed}
              />
              {option.label}
            </label>
          )}
        </For>
      </div>
    </fieldset>
  )
}

/** Choose one option, with a visible native indicator and group label. */
export function RadioGroup(props: RadioGroupProps): JSX.Element {
  return <RadioChoices {...props} />
}
