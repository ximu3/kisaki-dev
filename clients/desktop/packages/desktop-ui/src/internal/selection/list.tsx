/** @fileoverview Shared popup rows, selected marks and virtual scrolling handoff. */

import { createEffect, createMemo, For, onMount, Show } from 'solid-js'
import type { Accessor, JSX } from 'solid-js'
import { classes } from '../dom'
import { Icon, mdiCheck } from '../icons'
import { createPopup } from '../popup'
import { optionId } from './collection'
import type { SelectionCollection } from './collection'
import type { SelectionListProps, SelectionOption } from './types'
import styles from './styles.module.css'

interface ListProps extends SelectionListProps {
  id: string
  anchor: Accessor<HTMLElement>
  options: readonly SelectionOption[]
  collection: SelectionCollection
  selected: readonly string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onChoose: (option: SelectionOption) => void
  multiple?: boolean | undefined
  loading?: boolean | undefined
  emptyMessage?: JSX.Element
  loadingMessage?: JSX.Element
  label?: string | undefined
}

export function SelectionList(props: ListProps): JSX.Element {
  let list!: HTMLDivElement
  const groups = createMemo(() => {
    const result: { label: string | undefined; options: SelectionOption[] }[] = []
    for (const option of props.options) {
      const last = result.at(-1)
      if (last && last.label === option.group) {
        last.options.push(option)
      } else {
        result.push({ label: option.group, options: [option] })
      }
    }
    return result
  })
  createPopup({
    element: () => list,
    anchor: props.anchor,
    open: () => props.open,
    change: props.onOpenChange,
    matchWidth: true,
    restoreFocus: false,
  })

  onMount(() => {
    props.listRef?.(list)
    createEffect(() => {
      const active = props.collection.active()
      if (props.open && active !== undefined) {
        if (props.scrollToValue) {
          props.scrollToValue(active)
        } else {
          list.ownerDocument
            .getElementById(optionId(props.id, active))
            ?.scrollIntoView({ block: 'nearest' })
        }
      }
    })
  })

  const renderOption = (option: SelectionOption) => (
    <div
      id={optionId(props.id, option.value)}
      role="option"
      aria-selected={props.selected.includes(option.value)}
      aria-disabled={option.disabled || undefined}
      aria-posinset={props.options.indexOf(option) + 1}
      aria-setsize={props.options.length}
      data-active={props.collection.active() === option.value || undefined}
      class={styles.option}
      onPointerMove={() => {
        if (!option.disabled) {
          props.collection.highlight(option.value)
        }
      }}
      onClick={() => {
        if (!option.disabled && !props.anchor().matches(':disabled')) {
          props.onChoose(option)
        }
      }}
    >
      <span class={styles.optionText}>
        {option.content ?? option.label}
        <Show when={option.description}>
          <small>{option.description}</small>
        </Show>
      </span>
      <span class={styles.check}>
        <Show when={props.selected.includes(option.value)}>
          <Icon path={mdiCheck} />
        </Show>
      </span>
    </div>
  )

  return (
    <div
      ref={(node) => {
        list = node
      }}
      id={props.id}
      popover="auto"
      role="listbox"
      aria-label={props.label}
      aria-multiselectable={props.multiple || undefined}
      aria-busy={props.loading || undefined}
      class={classes(styles.list, props.listClass)}
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) {
          event.preventDefault()
        }
      }}
    >
      <Show
        when={!props.loading}
        fallback={
          <div class={styles.message} role="status">
            {props.loadingMessage}
          </div>
        }
      >
        <Show
          when={props.options.length}
          fallback={<div class={styles.message}>{props.emptyMessage}</div>}
        >
          {props.renderOptions ? (
            props.renderOptions({
              options: () => props.options,
              open: () => props.open,
              renderOption,
            })
          ) : (
            <For each={groups()}>
              {(group) => (
                <div role={group.label ? 'group' : undefined} aria-label={group.label}>
                  <Show when={group.label}>
                    <div class={styles.groupTitle}>{group.label}</div>
                  </Show>
                  <For each={group.options}>{renderOption}</For>
                </div>
              )}
            </For>
          )}
        </Show>
      </Show>
    </div>
  )
}
