/** @fileoverview Editable listbox with a separately owned selection, query and asynchronous option list. */

import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  onMount,
  Show,
  splitProps,
  type JSX,
} from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { inputClass, onFormReset } from './form/native'
import type { SelectOption } from './select'

export interface ComboboxProps extends Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'type' | 'children' | 'list' | 'role' | 'onInput'
> {
  /** The current result set. The caller filters or loads it in response to the query. */
  options: readonly SelectOption[]
  /** An absent result page does not discard the selected item's label. Null clears selection. */
  value?: SelectOption | null | undefined
  defaultValue?: SelectOption | null
  onValueChange?: (option: SelectOption | null) => void
  onQueryChange?: (text: string) => void
  /** Optional contents for loading, failure or an empty result set. */
  status?: JSX.Element
}

/** Arrow keys explore results while DOM focus stays in the input. Enter accepts; Escape restores the label. */
export function Combobox(props: ComboboxProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'class',
    'ref',
    'options',
    'value',
    'defaultValue',
    'onValueChange',
    'onQueryChange',
    'status',
    'name',
    'required',
    'form',
    'disabled',
  ])
  const id = createUniqueId()
  const [draft, setDraft] = createSignal<SelectOption | null>(local.defaultValue ?? null)
  const [query, setQuery] = createSignal('')
  const [open, setOpen] = createSignal(false)
  const [active, setActive] = createSignal<string>()
  let composing = false
  let input!: HTMLInputElement
  let list!: HTMLDivElement
  let backing!: HTMLSelectElement

  const selection = createMemo(() => {
    const saved = local.value === undefined ? draft() : local.value
    if (!saved) {
      return null
    }
    const current = local.options.find((item) => item.value === saved.value) ?? saved
    return current.disabled ? null : current
  })
  const enabled = createMemo(() => local.options.filter((option) => !option.disabled))
  const index = () =>
    local.options.findIndex((option) => !option.disabled && option.value === active())
  const optionId = (n: number) => id + '-option-' + n

  /** Anchor the list at the text input and start from the current selection. */
  function begin(): void {
    if (open() || input.matches(':disabled') || input.readOnly) {
      return
    }
    setQuery(selection()?.label ?? '')
    setActive(selection()?.value)
    list.showPopover({ source: input })
    setOpen(true)
  }

  /** Discard the query and return to the committed label. */
  function close(): void {
    list.hidePopover()
    setOpen(false)
    setActive(undefined)
  }

  /** Deliver a selected option or an explicit clear, then leave edit mode. */
  function choose(option: SelectOption | null): void {
    setDraft(option)
    local.onValueChange?.(option)
    close()
  }

  /** Pass the committed query to the owner of the result set. */
  function search(): void {
    if (composing) {
      return
    }
    const text = input.value
    begin()
    setQuery(text)
    setActive(undefined)
    local.onQueryChange?.(text)
  }

  /** Navigate real, enabled options while keeping text focus in the input. */
  function keyboard(event: KeyboardEvent): void {
    if (composing || event.isComposing || input.readOnly || event.defaultPrevented) {
      return
    }
    if (event.key === 'Escape' && open()) {
      event.preventDefault()
      event.stopPropagation()
      close()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      begin()
      const choices = enabled()
      const current = choices.findIndex((item) => item.value === active())
      let next = current + (event.key === 'ArrowDown' ? 1 : -1)
      if (current < 0 && event.key === 'ArrowUp') {
        next = choices.length - 1
      }
      setActive(choices[Math.min(choices.length - 1, Math.max(0, next))]?.value)
      list.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' })
    } else if (event.key === 'Enter' && open()) {
      event.preventDefault()
      const option = local.options[index()]
      if (option) {
        choose(option)
      } else if (!input.value) {
        choose(null)
      }
    }
  }

  createEffect(() => {
    if (local.disabled && open()) {
      close()
    }
  })
  onMount(() => onFormReset(backing, () => choose(local.defaultValue ?? null)))
  return (
    <>
      <input
        {...rest}
        ref={(el) => {
          input = el
          if (typeof local.ref === 'function') {
            local.ref(el)
          }
        }}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={id}
        aria-expanded={open()}
        aria-activedescendant={open() && index() >= 0 ? optionId(index()) : undefined}
        aria-required={local.required}
        form={local.form}
        disabled={local.disabled}
        autocomplete="off"
        value={open() ? query() : (selection()?.label ?? '')}
        class={twMerge(inputClass, 'h-7', local.class)}
        on:click={begin}
        on:input={search}
        on:compositionstart={() => {
          begin()
          composing = true
        }}
        on:compositionend={() => {
          composing = false
          search()
        }}
        on:keydown={keyboard}
        on:blur={close}
      />
      <select
        aria-hidden="true"
        tabIndex={-1}
        class="sr-only"
        name={local.name}
        form={local.form}
        disabled={local.disabled}
        required={local.required}
        ref={(element) => {
          backing = element
        }}
        on:invalid={(event) => {
          event.preventDefault()
          input.focus()
        }}
      >
        <option value={selection()?.value ?? ''}>{selection()?.label}</option>
      </select>
      <div
        id={id}
        ref={(element) => {
          list = element
        }}
        role="listbox"
        aria-label={rest['aria-label']}
        aria-labelledby={rest['aria-labelledby'] ?? rest.id}
        popover="auto"
        class="ks-box ks-popover min-w-[anchor-size(width)] rounded-md border border-border bg-popover p-1 text-sm text-popover-foreground shadow-overlay"
        on:toggle={() => {
          setOpen(list.matches(':popover-open'))
        }}
        on:pointerdown={(event) => event.preventDefault()}
      >
        <For each={local.options}>
          {(option, i) => (
            <div
              id={optionId(i())}
              role="option"
              aria-label={option.label}
              aria-description={option.description}
              aria-selected={selection()?.value === option.value}
              aria-current={active() === option.value}
              aria-disabled={!!option.disabled}
              class="cursor-default rounded-sm px-2 py-1 hover:bg-accent aria-current:bg-accent aria-current:text-accent-foreground aria-selected:font-medium aria-disabled:opacity-50"
              onClick={() => {
                if (!option.disabled && !input.matches(':disabled')) {
                  choose(option)
                }
              }}
            >
              {option.label}
              <Show when={option.description}>
                <span class="block text-xs text-muted-foreground">{option.description}</span>
              </Show>
            </div>
          )}
        </For>
        <Show when={local.status}>
          <div role="status" class="p-2 text-xs text-muted-foreground">
            {local.status}
          </div>
        </Show>
      </div>
    </>
  )
}
