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
import { assignRef, classes } from '../../internal/dom'
import { fieldAttributes } from '../../internal/field'
import { Icon, mdiChevronDown } from '../../internal/icon/icon'
import { createSelection } from '../../internal/selection/collection'
import { SelectionList } from '../../internal/selection/list'
import type { SelectionListProps, SelectionOption } from '../../internal/selection/types'
import { SelectionTrigger } from '../../internal/selection/trigger'
import { createValue, onFormReset } from '../../internal/state'
import { SelectedChips } from './chips'
import type { ChipLabels } from './chips'
import surface from '../../internal/input-surface.module.css'
import styles from './styles.module.css'

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
export interface MultiSelectProps extends SelectBaseProps, ChipLabels {
  value?: readonly string[]
  defaultValue?: readonly string[]
  onValueChange?: (value: readonly string[]) => void
}

/** A single choice closes the list. The trigger keeps keyboard focus and native form validation targets it. */
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

/** Toggle choices in the open list or remove them directly in the field. Submission preserves selected order. */
export function MultiSelect(props: MultiSelectProps): JSX.Element {
  const [local, labels, rest] = splitProps(
    props,
    ['value', 'defaultValue', 'onValueChange'],
    ['removeLabel', 'scrollPreviousLabel', 'scrollNextLabel'],
  )
  const [value, change] = createValue(
    () => local.value,
    () => local.defaultValue ?? [],
    (next) => local.onValueChange?.(next),
  )

  return (
    <SelectionControl
      {...rest}
      chips={mergeProps(labels, {
        remove: (key: string) => change(value().filter((item) => item !== key)),
      })}
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
  chips?: ChipLabels & { remove: (key: string) => void }
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
    'chips',
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
  const multiple = () => local.chips !== undefined
  const attributes = mergeProps(fieldAttributes(), rest)
  const [open, setOpen] = createSignal(false)
  const collection = createSelection(() => local.options)
  const id = createUniqueId()
  let trigger!: HTMLButtonElement
  let frame!: HTMLDivElement
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
    if (!multiple() && !selectedOptions().length) {
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
  const choose = (option: SelectionOption) => {
    local.onChoose(option)
    if (!multiple()) {
      setOpen(false)
    }
  }

  return (
    <div
      ref={(node) => {
        frame = node
      }}
      class={
        multiple()
          ? classes(
              styles.container,
              surface.surface,
              surface.singleLine,
              styles.multiple,
              local.class,
            )
          : styles.container
      }
      aria-invalid={multiple() ? attributes['aria-invalid'] : undefined}
    >
      <Show when={local.chips}>
        {(chips) => (
          <SelectedChips
            values={local.selected}
            label={(key) => collection.byValue().get(key)?.label ?? key}
            disabled={attributes.disabled}
            removeLabel={chips().removeLabel}
            scrollPreviousLabel={chips().scrollPreviousLabel}
            scrollNextLabel={chips().scrollNextLabel}
            onRemove={chips().remove}
            focusTrigger={() => trigger.focus()}
          />
        )}
      </Show>
      <SelectionTrigger
        {...attributes}
        listId={id}
        collection={collection}
        selected={local.selected}
        open={open()}
        onOpenChange={setOpen}
        onChoose={choose}
        onClick={local.onClick}
        onBlur={local.onBlur}
        onKeyDown={local.onKeyDown}
        aria-required={local.required ?? attributes.required}
        ref={(node) => {
          trigger = node
          assignRef(local.ref, node)
        }}
        class={
          multiple()
            ? styles.toggle
            : classes(surface.surface, surface.singleLine, styles.trigger, local.class)
        }
      >
        <span
          class={
            multiple() && local.selected.length
              ? styles.summary
              : classes(styles.value, !selectedOptions().length ? styles.placeholder : undefined)
          }
        >
          {local.selected.map((key) => collection.byValue().get(key)?.label ?? key).join(', ') ||
            local.placeholder}
        </span>
        <Icon path={mdiChevronDown} class={styles.arrow} />
      </SelectionTrigger>
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
        multiple={multiple()}
        onInvalid={local.onInvalid}
        onFocus={() => trigger.focus()}
      >
        <Show when={!multiple()}>
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
        reference={() => frame}
        options={local.options}
        collection={collection}
        selected={local.selected}
        multiple={multiple()}
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
