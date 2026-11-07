/** @fileoverview Shared popup rows, selected marks and virtual scrolling handoff. */

import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import type { Accessor, JSX } from 'solid-js'
import { classes } from '../dom'
import { Icon, mdiCheck } from '../icon/icon'
import { createPopup } from '../popup/controller'
import { optionId } from './collection'
import type { SelectionCollection } from './collection'
import type { SelectionListProps, SelectionOption } from './types'
import surface from '../popup/surface.module.css'
import row from '../list-row.module.css'
import styles from './styles.module.css'

interface ListProps extends SelectionListProps {
  id: string
  anchor: Accessor<HTMLElement>
  reference?: Accessor<HTMLElement> | undefined
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

/** The trigger owns focus and the collection owns navigation, including offscreen virtual rows. */
export function SelectionList(props: ListProps): JSX.Element {
  let list!: HTMLDivElement

  const groups = () => {
    const result: { label: string | undefined; options: SelectionOption[] }[] = []
    for (const option of props.collection.options()) {
      const last = result.at(-1)
      if (last && last.label === option.group) {
        last.options.push(option)
      } else {
        result.push({ label: option.group, options: [option] })
      }
    }
    return result
  }

  createPopup({
    element: () => list,
    anchor: props.anchor,
    reference: props.reference,
    open: () => props.open,
    change: props.onOpenChange,
    matchWidth: true,
    restoreFocus: false,
  })

  onMount(() => {
    props.listRef?.(list)
    const [height, setHeight] = createSignal(0)
    const size = new ResizeObserver(() => setHeight(list.clientHeight))
    size.observe(list)
    onCleanup(() => size.disconnect())

    createEffect(() => {
      const active = props.collection.active()
      if (!props.open || active === undefined || !height()) {
        return
      }

      // Virtual layouts must receive the open viewport's size before positioning the active row.
      const frame = requestAnimationFrame(() => {
        if (props.scrollToValue) {
          props.scrollToValue(active)
        } else {
          list.ownerDocument
            .getElementById(optionId(props.id, active))
            ?.scrollIntoView({ block: 'nearest' })
        }
      })
      onCleanup(() => cancelAnimationFrame(frame))
    })
  })

  const renderOption = (option: SelectionOption) => (
    <div
      id={optionId(props.id, option.value)}
      role="option"
      aria-selected={props.selected.includes(option.value)}
      aria-disabled={option.disabled || undefined}
      aria-posinset={props.collection.positionOf(option.value)}
      aria-setsize={props.collection.options().length}
      data-last={option.value === props.collection.options().at(-1)?.value || undefined}
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
      <div class={row.row}>
        <span class={styles.optionText}>
          {option.content ?? option.label}
          <Show when={option.description}>
            <small>{option.description}</small>
          </Show>
        </span>
        <span class={row.mark}>
          <Show when={props.selected.includes(option.value)}>
            <Icon path={mdiCheck} />
          </Show>
        </span>
      </div>
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
      class={classes(surface.surface, styles.list, props.listClass)}
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
          when={props.collection.options().length}
          fallback={<div class={styles.message}>{props.emptyMessage}</div>}
        >
          {props.renderOptions ? (
            props.renderOptions({
              options: props.collection.options,
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
