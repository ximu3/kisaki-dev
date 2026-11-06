/** @fileoverview Native single and multiple selection, including form reset and dynamic options. */

import { createEffect, onCleanup, onMount, splitProps, untrack } from 'solid-js'
import type { Accessor, JSX } from 'solid-js'
import { assignRef, callHandler, classes } from '../../internal/dom'
import { fieldAttributes } from '../../internal/field'
import { createValue, onFormReset } from '../../internal/state'
import styles from './styles.module.css'

/** Single select uses option/optgroup children; the empty string is the default selection. */
export interface SelectProps extends Omit<
  JSX.SelectHTMLAttributes<HTMLSelectElement>,
  'value' | 'multiple'
> {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

/** Native listbox with repeated FormData entries; values retain option order on user changes. */
export interface MultiSelectProps extends Omit<
  JSX.SelectHTMLAttributes<HTMLSelectElement>,
  'value' | 'multiple'
> {
  value?: readonly string[]
  defaultValue?: readonly string[]
  onValueChange?: (value: readonly string[]) => void
}

/** Synchronize selected options after both Solid updates and actual option-tree changes. */
function bindOptions(
  element: Accessor<HTMLSelectElement>,
  values: Accessor<readonly string[]>,
  defaults: Accessor<readonly string[]>,
  reset: () => void,
) {
  const sync = () => {
    if (!element().multiple) {
      element().value = values()[0] ?? ''
      return
    }

    const selected = new Set(values())
    for (const option of element().options) {
      option.selected = selected.has(option.value)
    }
  }

  onMount(() => {
    const node = element()
    const baseline = () => {
      const selected = new Set(defaults())
      for (const option of node.options) {
        option.defaultSelected = selected.has(option.value)
      }
      sync()
    }
    createEffect(baseline)
    createEffect(sync)

    const observer = new MutationObserver(baseline)
    observer.observe(node, { childList: true, subtree: true })
    onCleanup(() => observer.disconnect())
  })
  onFormReset(element, () => {
    reset()
    sync()
  })

  return sync
}

/** Uses customizable native select/picker; browser keyboard, validity and disabled rules stay intact. */
export function Select(props: SelectProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'value',
    'defaultValue',
    'onValueChange',
    'class',
    'ref',
    'onChange',
  ])

  const [value, change] = createValue(
    () => local.value,
    () => local.defaultValue ?? '',
    (next) => local.onValueChange?.(next),
  )
  let select!: HTMLSelectElement
  const sync = bindOptions(
    () => select,
    () => [value()],
    () => [local.defaultValue ?? ''],
    () => change(local.defaultValue ?? ''),
  )

  return (
    <select
      {...fieldAttributes()}
      {...rest}
      ref={(node) => {
        select = node
        assignRef(local.ref, node)
      }}
      class={classes(styles.root, local.class)}
      onChange={(event) => {
        change(event.currentTarget.value)
        untrack(sync)
        callHandler(local.onChange, event)
      }}
    />
  )
}

/** Native multiple selection retains platform modifiers and requires no hidden submission mirror. */
export function MultiSelect(props: MultiSelectProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'value',
    'defaultValue',
    'onValueChange',
    'class',
    'ref',
    'onChange',
  ])

  const [value, change] = createValue(
    () => local.value,
    () => local.defaultValue ?? [],
    (next) => local.onValueChange?.(next),
  )
  let select!: HTMLSelectElement
  const sync = bindOptions(
    () => select,
    value,
    () => local.defaultValue ?? [],
    () => change(local.defaultValue ?? []),
  )

  return (
    <select
      size={4}
      {...fieldAttributes()}
      {...rest}
      multiple
      ref={(node) => {
        select = node
        assignRef(local.ref, node)
      }}
      class={classes(styles.root, local.class)}
      onChange={(event) => {
        change(Array.from(event.currentTarget.selectedOptions, (option) => option.value))
        untrack(sync)
        callHandler(local.onChange, event)
      }}
    />
  )
}
