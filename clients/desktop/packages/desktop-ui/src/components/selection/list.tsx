/** @fileoverview Shared popup rows, selected marks and virtual scrolling handoff. */

import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import type { Accessor, JSX } from 'solid-js'
import { classes } from '../../internal/dom'
import { Icon, Check } from '../../internal/icon/glyph'
import { createPopup } from '../../internal/popup/controller'
import { displayedWhileOpen } from '../../internal/popup/presentation'
import type { SelectionPopup } from './popup'
import { optionId } from './collection'
import type { SelectionCollection } from './collection'
import type { SelectionListProps, SelectionOption } from './types'
import { ComboboxSearch } from './search'
import type { SearchState } from './search'
import { createVirtualChoices, type OptionGroup } from './virtual'
import frame from '../../internal/popup/surface.module.css'
import row from '../../internal/list-row.module.css'
import styles from './styles.module.css'

/**
 * Logical option and selection state connected to a popup, optional search editor and row renderer.
 */
interface ListProps<O extends SelectionOption> extends SelectionListProps<O> {
  popup: SelectionPopup
  /** Returns the interaction anchor used by native popup and focus handling. */
  anchor: Accessor<HTMLButtonElement | undefined>
  /** Returns an optional geometry reference distinct from the interaction anchor. */
  reference?: Accessor<HTMLElement> | undefined
  collection: SelectionCollection<O>
  selected: readonly string[]
  /** Reports an enabled chosen option to the value owner. */
  onChoose: (option: O) => void
  multiple?: boolean | undefined
  loading?: boolean | undefined
  emptyMessage?: JSX.Element
  loadingMessage?: JSX.Element
  label?: string | undefined
  labelledBy?: string | undefined
  search?: SearchState | undefined
}

/**
 * Renders logical options and selection marks in an anchored popup with optional search and
 * virtualization.
 *
 * The trigger or search editor retains focus; the collection owns navigation across mounted and
 * offscreen rows.
 */
export function SelectionList<O extends SelectionOption>(props: ListProps<O>): JSX.Element {
  const [list, setList] = createSignal<HTMLDivElement>()
  const { id, open, present } = props.popup
  const selected = displayedWhileOpen(open, () => props.selected)

  createEffect(() => {
    if (props.search && open() && props.collection.active() === undefined) {
      props.collection.highlight(props.collection.enabled()[0]?.value)
    }
  })

  const groups = createMemo(() => {
    const result: OptionGroup<O>[] = []
    for (const option of props.collection.options()) {
      const last = result.at(-1)
      if (last && last.label === option.group) {
        last.options.push(option)
      } else {
        result.push({ label: option.group, options: [option] })
      }
    }
    return result
  })
  let rowHeight = 0
  const virtual = createVirtualChoices(
    groups,
    list,
    () => !!props.virtual && present(),
    () => {
      // Keep the last measured estimate if the trigger is released during exit.
      rowHeight = props.anchor()?.getBoundingClientRect().height ?? rowHeight
      return rowHeight
    },
  )

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
    const viewport = list()!
    props.listRef?.(viewport)
    const [height, setHeight] = createSignal(0)
    const size = new ResizeObserver(() => setHeight(viewport.clientHeight))
    size.observe(viewport)
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
        } else if (props.virtual) {
          virtual.scrollTo(active)
        } else {
          viewport.ownerDocument
            .getElementById(optionId(id, active))
            ?.scrollIntoView({ block: 'nearest' })
        }
      })
      onCleanup(() => cancelAnimationFrame(frame))
    })
  })

  /**
   * Renders a stable option identity with logical position, selection state and enabled pointer
   * actions.
   */
  const renderOption = (option: O) => (
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
        if (!option.disabled && props.anchor()?.matches(':enabled')) {
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
            <Icon icon={Check} />
          </Show>
        </span>
      </div>
    </div>
  )

  function renderRows(): JSX.Element {
    if (props.renderOptions) {
      return props.renderOptions({ options: props.collection.options, open, present, renderOption })
    }
    if (props.virtual) {
      return <virtual.Render option={renderOption} />
    }

    return (
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
    )
  }

  return (
    <div
      popover="auto"
      ref={props.popup.attach}
      id={props.popup.panelId}
      class={classes(frame.anchor, styles.list, props.listClass)}
    >
      <div class={classes(frame.viewport, styles.content)}>
        <Show when={props.search}>
          {(search) => (
            <ComboboxSearch
              state={search()}
              listId={id}
              open={open()}
              collection={props.collection}
              choose={props.onChoose}
            />
          )}
        </Show>
        <div
          ref={setList}
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
              {renderRows()}
            </Show>
          </Show>
        </div>
      </div>
    </div>
  )
}
