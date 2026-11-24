import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onSettled,
  Show,
  type Accessor,
} from 'solid-js'
import type { JSX } from '@solidjs/web'
import { Icon, Check } from '../../internal/icon/glyph'
import { createPopup } from '../../internal/popup/controller'
import { displayedWhileOpen } from '../../internal/popup/presentation'
import type { SelectionPopup } from './popup'
import { optionId, type SelectionCollection } from './collection'
import type { SelectionListProps, SelectionOption } from './types'
import { ComboboxSearch, type SearchState } from './search'
import { createVirtualChoices, type OptionGroup } from './virtual'
import frame from '../../internal/popup/surface.module.css'
import row from '../../internal/list-row.module.css'
import styles from './styles.module.css'

interface ListProps<O extends SelectionOption> extends SelectionListProps<O> {
  popup: SelectionPopup
  anchor: Accessor<HTMLButtonElement | undefined>
  reference?: Accessor<HTMLElement> | undefined
  collection: SelectionCollection<O>
  selected: readonly string[]
  onChoose: (option: O) => void
  multiple?: boolean | undefined
  loading?: boolean | undefined
  emptyMessage?: JSX.Element
  loadingMessage?: JSX.Element
  label?: string | undefined
  labelledBy?: string | undefined
  search?: SearchState | undefined
}

export function SelectionList<O extends SelectionOption>(props: ListProps<O>): JSX.Element {
  const [list, setList] = createSignal<HTMLDivElement>()
  const { id, open, present } = props.popup
  const selected = displayedWhileOpen(open, () => props.selected)

  createEffect(
    () =>
      props.search && open() && props.collection.active() === undefined
        ? props.collection.enabled()[0]?.value
        : undefined,
    (first) => {
      if (first !== undefined) {
        props.collection.highlight(first)
      }
    },
  )

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
  const rowHeight = createMemo<number>(
    (previous = 32) => props.anchor()?.getBoundingClientRect().height || previous,
  )
  const usesVirtualChoices = () => !!props.virtual && !props.renderOptions
  const virtual = createVirtualChoices(
    groups,
    list,
    () => usesVirtualChoices() && present(),
    props.collection.active,
    rowHeight,
  )

  createPopup({
    element: props.popup.panel,
    anchor: props.anchor,
    reference: props.reference,
    open,
    change: props.popup.setOpen,
    matchWidth: true,
    get restoreFocus() {
      return props.search !== undefined
    },
  })

  const [height, setHeight] = createSignal(0)

  onSettled(() => {
    const viewport = list()!
    props.listRef?.(viewport)
    const size = new ResizeObserver(() => setHeight(viewport.clientHeight))
    size.observe(viewport)
    return () => size.disconnect()
  })

  createEffect(
    () => (open() && height() ? props.collection.active() : undefined),
    (active) => {
      if (active === undefined) {
        return
      }

      // Virtual layouts must receive the open viewport's size before positioning the active row.
      const frame = requestAnimationFrame(() => {
        if (props.scrollToValue) {
          props.scrollToValue(active)
        } else if (usesVirtualChoices()) {
          virtual.scrollTo(active)
        } else {
          list()!
            .ownerDocument.getElementById(optionId(id, active))
            ?.scrollIntoView({ block: 'nearest' })
        }
      })

      return () => cancelAnimationFrame(frame)
    },
  )

  const renderOption = (option: O) => (
    <div
      id={optionId(id, option.value)}
      role="option"
      aria-selected={selected().includes(option.value) ? 'true' : 'false'}
      aria-disabled={option.disabled ? 'true' : undefined}
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
    if (usesVirtualChoices()) {
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
      class={[frame.anchor, styles.list, props.listClass]}
    >
      <div class={[frame.viewport, styles.content]}>
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
          aria-multiselectable={props.multiple ? 'true' : undefined}
          aria-busy={props.loading ? 'true' : undefined}
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
