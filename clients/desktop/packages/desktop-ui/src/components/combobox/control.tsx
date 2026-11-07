/** @fileoverview Editable selection separates query, committed identity and logical option navigation. */

import {
  createEffect,
  createSignal,
  createUniqueId,
  mergeProps,
  onMount,
  splitProps,
  untrack,
} from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, callHandler, classes } from '../../internal/dom'
import { fieldAttributes, closeWhenUnavailable } from '../../internal/field'
import { Icon, mdiChevronDown } from '../../internal/icon/icon'
import { createSelection, optionId } from '../../internal/selection/collection'
import { SelectionList } from '../../internal/selection/list'
import type { SelectionListProps, SelectionOption } from '../../internal/selection/types'
import { createValue, onFormReset } from '../../internal/state'
import surface from '../../internal/input-surface.module.css'
import styles from './styles.module.css'

export type ComboboxOption = SelectionOption

/** The host filters or loads options. The committed object survives changes to search results. */
export interface ComboboxProps
  extends
    Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'value' | 'type' | 'children'>,
    SelectionListProps {
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
}

/** Focus stays in the native input. Clearing removes the choice; leaving restores its committed label. */
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
    'listRef',
    'renderOptions',
    'scrollToValue',
    'class',
    'ref',
    'onInput',
    'onKeyDown',
    'onClick',
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
  const collection = createSelection(() => (local.loading ? [] : local.options))
  const id = createUniqueId()
  let input!: HTMLInputElement
  let composing = false

  const choice = () =>
    local.options.find((option) => option.value === selected()?.value) ?? selected()
  const restore = () => {
    setOpen(false)
    collection.highlight(undefined)
    setQuery(choice()?.label ?? '')
    input.value = query()
  }
  const choose = (option: ComboboxOption) => {
    select(option)
    restore()
  }
  closeWhenUnavailable(() => input, restore)

  onMount(() => {
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
      const invalid = !!choice()?.disabled || query() !== (choice()?.label ?? '')
      input.setCustomValidity(invalid ? local.invalidSelectionMessage : '')
    })
  })
  onFormReset(
    () => input,
    () => {
      select(local.defaultValue ?? null)
      restore()
    },
  )

  const updateQuery = () => {
    setQuery(input.value)
    collection.highlight(undefined)
    if (!composing) {
      if (!input.value) {
        select(null)
      }
      setOpen(true)
    }
  }

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
        aria-activedescendant={
          open() && collection.active() !== undefined
            ? optionId(id, collection.active()!)
            : undefined
        }
        ref={(node) => {
          input = node
          assignRef(local.ref, node)
        }}
        class={classes(surface.surface, surface.singleLine, styles.input, local.class)}
        onCompositionStart={(event) => {
          composing = true
          callHandler(local.onCompositionStart, event)
        }}
        onCompositionEnd={(event) => {
          composing = false
          updateQuery()
          callHandler(local.onCompositionEnd, event)
        }}
        onInput={(event) => {
          updateQuery()
          callHandler(local.onInput, event)
        }}
        onClick={(event) => {
          callHandler(local.onClick, event)
          if (!event.defaultPrevented && !input.readOnly) {
            setOpen(true)
          }
        }}
        onBlur={(event) => {
          restore()
          callHandler(local.onBlur, event)
        }}
        onKeyDown={(event) => {
          callHandler(local.onKeyDown, event)
          if (event.defaultPrevented || event.isComposing || composing || input.readOnly) {
            return
          }

          if (event.altKey && event.key === 'ArrowUp') {
            event.preventDefault()
            restore()
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
            collection.move(event.key === 'ArrowDown' ? 1 : -1)
          } else if (open() && (event.key === 'Home' || event.key === 'End')) {
            event.preventDefault()
            collection.move(event.key === 'Home' ? 'first' : 'last')
          } else if (open() && event.key === 'Enter') {
            const option = collection.byValue().get(collection.active() ?? '')
            if (option) {
              event.preventDefault()
              choose(option)
            }
          }
        }}
      />
      <Icon path={mdiChevronDown} class={styles.arrow} />
      <input
        type="hidden"
        name={local.name}
        form={props.form}
        value={selected()?.value ?? ''}
        disabled={attributes.disabled || choice()?.disabled}
      />
      <SelectionList
        id={id}
        anchor={() => input}
        collection={collection}
        options={local.options}
        selected={selected() ? [selected()!.value] : []}
        open={open()}
        onOpenChange={(next) => {
          if (next) {
            setOpen(true)
          } else {
            restore()
          }
        }}
        onChoose={choose}
        loading={local.loading}
        emptyMessage={local.emptyMessage}
        loadingMessage={local.loadingMessage}
        listClass={local.listClass}
        listRef={local.listRef}
        renderOptions={local.renderOptions}
        scrollToValue={local.scrollToValue}
        label={props['aria-label']}
      />
    </div>
  )
}
