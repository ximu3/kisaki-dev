/** @fileoverview Shared popup rows, selected marks and virtual scrolling handoff. */

import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import type { Accessor, JSX } from 'solid-js'
import { classes } from '../dom'
import { Icon, mdiCheck } from '../icon/icon'
import { createPopup } from '../popup/controller'
import { displayedWhileOpen } from '../popup/presentation'
import type { SelectionPopup } from './popup'
import { optionId } from './collection'
import type { SelectionCollection } from './collection'
import type { SelectionListProps, SelectionOption } from './types'
import { SearchInput } from './search'
import type { SearchState } from './search'
import frame from '../popup/surface.module.css'
import row from '../list-row.module.css'
import styles from './styles.module.css'

interface ListProps extends SelectionListProps {
  popup: SelectionPopup
  anchor: Accessor<HTMLElement>
  reference?: Accessor<HTMLElement> | undefined
  collection: SelectionCollection
  selected: readonly string[]
  onChoose: (option: SelectionOption) => void
  multiple?: boolean | undefined
  loading?: boolean | undefined
  emptyMessage?: JSX.Element
  loadingMessage?: JSX.Element
  label?: string | undefined
  labelledBy?: string | undefined
  search?: SearchState | undefined
}

/** The trigger owns focus and the collection owns navigation, including offscreen virtual rows. */
export function SelectionList(props: ListProps): JSX.Element {
  let list!: HTMLDivElement
  const { id, open, present } = props.popup
  const selected = displayedWhileOpen(open, () => props.selected)

  createEffect(() => {
    if (props.search && open() && props.collection.active() === undefined) {
      props.collection.highlight(props.collection.enabled()[0]?.value)
    }
  })

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
    element: props.popup.panel,
    anchor: props.anchor,
    reference: props.reference,
    open,
    change: props.popup.setOpen,
    matchWidth: true,
    restoreFocus: props.search !== undefined,
  })

  onMount(() => {
    props.listRef?.(list)
    const [height, setHeight] = createSignal(0)
    const size = new ResizeObserver(() => setHeight(list.clientHeight))
    size.observe(list)
    onCleanup(() => size.disconnect())

    createEffect(() => {
      const active = props.collection.active()
      if (!open() || active === undefined || !height()) {
        return
      }

      // Virtual layouts must receive the open viewport's size before positioning the active row.
      const frame = requestAnimationFrame(() => {
        if (props.scrollToValue) {
          props.scrollToValue(active)
        } else {
          list.ownerDocument
            .getElementById(optionId(id, active))
            ?.scrollIntoView({ block: 'nearest' })
        }
      })
      onCleanup(() => cancelAnimationFrame(frame))
    })
  })

  const renderOption = (option: SelectionOption) => (
    <div
      id={optionId(id, option.value)}
      role="option"
      aria-selected={selected().includes(option.value)}
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
          <Show when={selected().includes(option.value)}>
            <Icon path={mdiCheck} />
          </Show>
        </span>
      </div>
    </div>
  )

  return (
    <div
      popover="auto"
      ref={props.popup.attach}
      id={props.popup.panelId}
      class={classes(frame.anchor, styles.list, props.listClass)}
      role={props.search ? 'dialog' : undefined}
      aria-labelledby={props.search ? props.labelledBy : undefined}
      aria-label={props.search ? (props.label ?? props.search.label) : undefined}
    >
      <div class={classes(frame.viewport, styles.content)}>
        <Show when={props.search}>
          {(search) => (
            <SearchInput
              state={search()}
              listId={id}
              open={open()}
              collection={props.collection}
              choose={props.onChoose}
            />
          )}
        </Show>
        <div
          ref={(node) => {
            list = node
          }}
          class={styles.options}
          id={id}
          role="listbox"
          aria-label={props.label}
          aria-labelledby={props.labelledBy}
          aria-multiselectable={props.multiple || undefined}
          aria-busy={props.loading || undefined}
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
                  open,
                  present,
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
      </div>
    </div>
  )
}
