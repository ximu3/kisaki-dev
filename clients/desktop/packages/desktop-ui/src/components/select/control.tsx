/** @fileoverview Data-model single and multiple selection with native form participation. */

import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  mergeProps,
  onMount,
  Show,
  splitProps,
  untrack,
} from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, callHandler, classes } from '../../internal/dom'
import { fieldAttributes, closeWhenUnavailable } from '../../internal/field'
import { Icon, mdiChevronDown } from '../../internal/icons'
import { createSelection, optionId } from '../../internal/selection/collection'
import { SelectionList } from '../../internal/selection/list'
import type { SelectionListProps, SelectionOption } from '../../internal/selection/types'
import { createValue, onFormReset } from '../../internal/state'
import styles from '../../internal/selection/styles.module.css'

interface SelectBaseProps
  extends
    Omit<
      JSX.ButtonHTMLAttributes<HTMLButtonElement>,
      'value' | 'children' | 'type' | 'onChange' | 'onInvalid'
    >,
    SelectionListProps {
  options: readonly SelectionOption[]
  placeholder?: string
  emptyMessage: JSX.Element
  invalidSelectionMessage: string
  required?: boolean
  onInvalid?: JSX.SelectHTMLAttributes<HTMLSelectElement>['onInvalid']
}

/** An empty value represents no choice. Options retain identity independently of mounted rows. */
export interface SelectProps extends SelectBaseProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

/** User activation toggles one value; no platform modifier key is required. */
export interface MultiSelectProps extends SelectBaseProps {
  value?: readonly string[]
  defaultValue?: readonly string[]
  onValueChange?: (value: readonly string[]) => void
}

export function Select(props: SelectProps): JSX.Element {
  const [local, rest] = splitProps(props, ['value', 'defaultValue', 'onValueChange'])
  const [value, change] = createValue(
    () => local.value,
    () => local.defaultValue ?? '',
    (next) => local.onValueChange?.(next),
  )

  return (
    <SelectionControl
      {...rest}
      selected={value() ? [value()] : []}
      defaults={local.defaultValue ? [local.defaultValue] : []}
      onChoose={(option) => change(option.value)}
      onReset={() => change(local.defaultValue ?? '')}
    />
  )
}

export function MultiSelect(props: MultiSelectProps): JSX.Element {
  const [local, rest] = splitProps(props, ['value', 'defaultValue', 'onValueChange'])
  const [value, change] = createValue(
    () => local.value,
    () => local.defaultValue ?? [],
    (next) => local.onValueChange?.(next),
  )

  return (
    <SelectionControl
      {...rest}
      multiple
      selected={value()}
      defaults={local.defaultValue ?? []}
      onChoose={(option) =>
        change(
          value().includes(option.value)
            ? value().filter((item) => item !== option.value)
            : [...value(), option.value],
        )
      }
      onReset={() => change(local.defaultValue ?? [])}
    />
  )
}

interface SelectionControlProps extends SelectBaseProps {
  multiple?: boolean
  selected: readonly string[]
  defaults: readonly string[]
  onChoose: (option: SelectionOption) => void
  onReset: () => void
}

/** Shared presentation and submission, with choice policy supplied by each public control. */
function SelectionControl(props: SelectionControlProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'options',
    'placeholder',
    'emptyMessage',
    'invalidSelectionMessage',
    'required',
    'renderOptions',
    'scrollToValue',
    'listRef',
    'listClass',
    'multiple',
    'selected',
    'defaults',
    'onChoose',
    'onReset',
    'ref',
    'class',
    'onClick',
    'onKeyDown',
    'onBlur',
    'onInvalid',
    'name',
  ])
  const attributes = mergeProps(fieldAttributes(), rest)
  const [open, setOpen] = createSignal(false)
  const collection = createSelection(() => local.options)
  const id = createUniqueId()
  let trigger!: HTMLButtonElement
  let mirror!: HTMLSelectElement

  const selectedOptions = createMemo(() =>
    local.selected.flatMap((value) => {
      const option = collection.byValue().get(value)
      return option ? [option] : []
    }),
  )
  const sync = () => {
    for (const option of mirror.options) {
      option.defaultSelected = local.defaults.includes(option.value)
      option.selected = local.selected.includes(option.value)
    }
    if (!local.multiple && !selectedOptions().length) {
      mirror.value = ''
    }
    const invalid = local.selected.some((value) => {
      const option = collection.byValue().get(value)
      return !option || option.disabled
    })
    mirror.setCustomValidity(invalid ? local.invalidSelectionMessage : '')
  }
  onMount(() => createEffect(sync))
  onFormReset(
    () => mirror,
    () => {
      local.onReset()
      untrack(sync)
      setOpen(false)
    },
  )
  closeWhenUnavailable(
    () => trigger,
    () => setOpen(false),
  )

  const show = () => {
    setOpen(true)
    const selected = selectedOptions().find((option) => !option.disabled)
    collection.highlight(selected?.value ?? collection.enabled()[0]?.value)
  }
  const choose = (option: SelectionOption) => {
    local.onChoose(option)
    if (!local.multiple) {
      setOpen(false)
    }
  }

  return (
    <div class={styles.container}>
      <button
        {...attributes}
        type="button"
        ref={(node) => {
          trigger = node
          assignRef(local.ref, node)
        }}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open()}
        aria-controls={id}
        aria-required={local.required ?? attributes.required}
        aria-activedescendant={
          open() && collection.active() !== undefined
            ? optionId(id, collection.active()!)
            : undefined
        }
        class={classes(styles.trigger, local.class)}
        onClick={(event) => {
          callHandler(local.onClick, event)
          if (!event.defaultPrevented) {
            if (open()) {
              setOpen(false)
            } else {
              show()
            }
          }
        }}
        onBlur={(event) => {
          setOpen(false)
          callHandler(local.onBlur, event)
        }}
        onKeyDown={(event) => {
          callHandler(local.onKeyDown, event)
          if (event.defaultPrevented || event.isComposing) {
            return
          }

          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open()) {
              show()
            } else {
              collection.move(event.key === 'ArrowDown' ? 1 : -1)
            }
          } else if (open() && (event.key === 'Home' || event.key === 'End')) {
            event.preventDefault()
            collection.move(event.key === 'Home' ? 'first' : 'last')
          } else if (open() && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            const option = collection.byValue().get(collection.active() ?? '')
            if (option) {
              choose(option)
            }
          } else if (
            event.key.length === 1 &&
            event.key !== ' ' &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            event.preventDefault()
            if (!open()) {
              show()
            }
            collection.type(event.key)
          }
        }}
      >
        <span
          class={classes(styles.value, !selectedOptions().length ? styles.placeholder : undefined)}
        >
          {selectedOptions()
            .map((option) => option.label)
            .join(', ') || local.placeholder}
        </span>
        <Icon path={mdiChevronDown} class={styles.arrow} />
      </button>
      <select
        ref={(node) => {
          mirror = node
        }}
        class={styles.submission}
        tabIndex={-1}
        aria-hidden="true"
        name={local.name}
        form={props.form}
        required={local.required ?? attributes.required}
        disabled={attributes.disabled}
        multiple={local.multiple}
        onInvalid={local.onInvalid}
        onFocus={() => trigger.focus()}
      >
        <Show when={!local.multiple}>
          <option value="" />
        </Show>
        <For each={selectedOptions()}>
          {(option) => (
            <option value={option.value} disabled={option.disabled} selected>
              {option.label}
            </option>
          )}
        </For>
      </select>
      <SelectionList
        id={id}
        anchor={() => trigger}
        options={local.options}
        collection={collection}
        selected={local.selected}
        multiple={local.multiple}
        open={open()}
        onOpenChange={setOpen}
        onChoose={choose}
        emptyMessage={local.emptyMessage}
        renderOptions={local.renderOptions}
        scrollToValue={local.scrollToValue}
        listRef={local.listRef}
        listClass={local.listClass}
        label={props['aria-label']}
      />
    </div>
  )
}
