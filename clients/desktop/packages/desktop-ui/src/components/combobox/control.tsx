/** @fileoverview Editable option search separates the query, committed choice and active option. */

import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  mergeProps,
  onCleanup,
  For,
  onMount,
  Show,
  splitProps,
  untrack,
} from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, callHandler, classes } from '../../internal/dom'
import { fieldAttributes } from '../../internal/field'
import { createValue, onFormReset } from '../../internal/state'
import { createPopup } from '../../internal/popup'
import styles from './styles.module.css'

/** Stable option identity; the chosen option remains available independently of asynchronous search results. */
export interface ComboboxOption {
  readonly value: string
  readonly label: string
  readonly description?: string
  readonly disabled?: boolean
}

/** The host filters/loads options. Editing searches; choosing commits; leaving the input restores the committed label. */
export interface ComboboxProps extends Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'type' | 'children'
> {
  options: readonly ComboboxOption[]
  value?: ComboboxOption | null
  defaultValue?: ComboboxOption | null
  onValueChange?: (value: ComboboxOption | null) => void

  inputValue?: string
  onInputValueChange?: (value: string) => void

  loading?: boolean
  emptyMessage: JSX.Element
  loadingMessage: JSX.Element
  invalidSelectionMessage: string
  listClass?: string
}

/** Keep focus in the native input. Arrow keys navigate, Enter commits, Escape cancels the candidate interaction. */
export function Combobox(props: ComboboxProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'options',
    'value',
    'defaultValue',
    'onValueChange',
    'inputValue',
    'onInputValueChange',
    'loading',
    'emptyMessage',
    'loadingMessage',
    'invalidSelectionMessage',
    'listClass',
    'class',
    'ref',
    'onInput',
    'onKeyDown',
    'onFocus',
    'onBlur',
    'name',
    'onCompositionStart',
    'onCompositionEnd',
  ])

  const attributes = mergeProps(fieldAttributes(), rest)
  const [selected, select] = createValue(
    () => local.value,
    () => local.defaultValue ?? null,
    (next) => local.onValueChange?.(next),
  )
  const [query, setQuery] = createValue(
    () => local.inputValue,
    () => untrack(selected)?.label ?? '',
    (next) => local.onInputValueChange?.(next),
  )

  const [open, setOpen] = createSignal(false)
  const [active, setActive] = createSignal<string>()
  const id = createUniqueId()
  let input!: HTMLInputElement
  let list!: HTMLDivElement
  let composing = false

  const options = () => local.options
  const available = createMemo(() =>
    local.loading ? [] : options().filter((option) => !option.disabled),
  )
  const activeIndex = () =>
    local.loading
      ? -1
      : options().findIndex((option) => option.value === active() && !option.disabled)
  const label = () => selected()?.label ?? ''

  const restore = () => {
    setOpen(false)
    setActive(undefined)
    setQuery(label())
    input.value = query()
  }

  const choose = (option: ComboboxOption) => {
    if (option.disabled || input.matches(':disabled')) {
      return
    }

    select(option)
    setQuery(option.label)
    setOpen(false)
    setActive(undefined)
    input.value = query()
  }

  createPopup({
    element: () => list,
    anchor: () => input,
    open,
    change: (next) => {
      setOpen(next)
      if (!next) {
        setActive(undefined)
      }
    },
    restoreFocus: false,
  })

  onMount(() => {
    const syncDisabled = () => {
      if (input.matches(':disabled')) {
        restore()
      }
    }
    const disabled = new MutationObserver(syncDisabled)
    disabled.observe(input, { attributes: true, attributeFilter: ['disabled'] })
    for (let ancestor = input.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.tagName === 'FIELDSET') {
        disabled.observe(ancestor, { attributes: true, attributeFilter: ['disabled'] })
      }
    }
    onCleanup(() => disabled.disconnect())

    createEffect(() => {
      const option = selected()
      untrack(() => {
        if (!composing) {
          setQuery(option?.label ?? '')
        }
      })
    })
    createEffect(() => {
      if (!composing && input.value !== query()) {
        input.value = query()
      }
    })
    createEffect(() => {
      const invalid = !!selected()?.disabled || query() !== label()
      input.setCustomValidity(invalid ? local.invalidSelectionMessage : '')
    })

    createEffect(() => {
      const index = activeIndex()
      if (open() && index >= 0) {
        list.querySelector(`[id="${id}-${index}"]`)?.scrollIntoView({ block: 'nearest' })
      }
    })
  })
  onFormReset(
    () => input,
    () => {
      select(local.defaultValue ?? null)
      setQuery(local.defaultValue?.label ?? '')
      restore()
    },
  )

  return (
    <div class={styles.container}>
      <input
        {...attributes}
        type="text"
        role="combobox"
        autocomplete="off"
        aria-autocomplete="list"
        aria-controls={id}
        aria-expanded={open()}
        aria-activedescendant={open() && activeIndex() >= 0 ? `${id}-${activeIndex()}` : undefined}
        ref={(node) => {
          input = node
          assignRef(local.ref, node)
        }}
        class={classes(styles.input, local.class)}
        onCompositionStart={(event) => {
          composing = true
          callHandler(local.onCompositionStart, event)
        }}
        onCompositionEnd={(event) => {
          composing = false
          setQuery(input.value)
          callHandler(local.onCompositionEnd, event)
        }}
        onInput={(event) => {
          setQuery(event.currentTarget.value)
          setActive(undefined)
          if (!composing) {
            setOpen(true)
          }
          callHandler(local.onInput, event)
        }}
        onFocus={(event) => callHandler(local.onFocus, event)}
        onBlur={(event) => {
          restore()
          callHandler(local.onBlur, event)
        }}
        onKeyDown={(event) => {
          callHandler(local.onKeyDown, event)
          if (event.defaultPrevented || event.isComposing || composing) {
            return
          }

          if (event.key === 'Escape' && open()) {
            event.preventDefault()
            event.stopPropagation()
            restore()
            return
          }

          if (event.altKey && event.key === 'ArrowUp') {
            event.preventDefault()
            restore()
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
            const items = available()
            const current = items.findIndex((option) => option.value === active())
            const step = event.key === 'ArrowDown' ? 1 : -1
            const first = step === 1 ? 0 : items.length - 1
            const index = current < 0 ? first : (current + step + items.length) % items.length
            setActive(items[index]?.value)
          } else if (open() && (event.key === 'Home' || event.key === 'End')) {
            event.preventDefault()
            setActive(event.key === 'Home' ? available()[0]?.value : available().at(-1)?.value)
          } else if (open() && event.key === 'Enter' && activeIndex() >= 0) {
            event.preventDefault()
            choose(options()[activeIndex()]!)
          }
        }}
      />
      <input
        type="hidden"
        name={local.name}
        form={props.form}
        value={selected()?.value ?? ''}
        disabled={attributes.disabled || selected()?.disabled}
      />
      <div
        ref={(node) => {
          list = node
        }}
        id={id}
        popover="auto"
        role="listbox"
        aria-busy={local.loading || undefined}
        class={classes(styles.list, local.listClass)}
        onPointerDown={(event) => event.preventDefault()}
      >
        <Show
          when={!local.loading}
          fallback={
            <div class={styles.message} role="status">
              {local.loadingMessage}
            </div>
          }
        >
          <For each={options()} fallback={<div class={styles.message}>{local.emptyMessage}</div>}>
            {(option, index) => (
              <div
                id={`${id}-${index()}`}
                role="option"
                aria-selected={selected()?.value === option.value}
                aria-disabled={option.disabled || undefined}
                data-active={active() === option.value || undefined}
                class={styles.option}
                onPointerMove={() => {
                  if (!option.disabled) {
                    setActive(option.value)
                  }
                }}
                onClick={() => choose(option)}
              >
                <span>{option.label}</span>
                <Show when={option.description}>
                  <small>{option.description}</small>
                </Show>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  )
}
