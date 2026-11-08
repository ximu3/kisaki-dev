/** @fileoverview A desktop choice field presents committed values, owns disclosure and participates in its form. */

import {
  createMemo,
  For,
  mergeProps,
  on,
  onMount,
  createEffect,
  Show,
  splitProps,
  untrack,
} from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, classes } from '../dom'
import { fieldAttributes } from '../field'
import { Icon, mdiChevronDown, mdiUnfoldMoreHorizontal } from '../icon/icon'
import { createValue, onFormReset } from '../state'
import { SelectedChips } from './chips'
import type { ChipLabels } from './chips'
import { createSelection } from './collection'
import { SelectionList } from './list'
import { SelectionTrigger } from './trigger'
import { createSelectionPopup } from './popup'
import type { SelectionListProps, SelectionOption } from './types'
import input from '../input-surface.module.css'
import styles from './field.module.css'

export interface ChoiceFieldProps
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

/** The host may supply filtered or asynchronous results with filter=false. */
export interface ChoiceSearchProps {
  searchLabel: string
  searchPlaceholder?: string
  query?: string
  onQueryChange?: (query: string) => void
  filter?: false | ((option: SelectionOption, query: string) => boolean)
  loading?: boolean
  loadingMessage: JSX.Element
}

interface SelectionFieldProps extends ChoiceFieldProps {
  selected: readonly SelectionOption[]
  defaults: readonly string[]
  chips?: ChipLabels & { remove: (key: string) => void }
  search?: ChoiceSearchProps
  onChoose: (option: SelectionOption) => void
  onReset: () => void
}

export function SelectionField(props: SelectionFieldProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'options',
    'selected',
    'defaults',
    'chips',
    'search',
    'onChoose',
    'onReset',
    'required',
    'placeholder',
    'emptyMessage',
    'invalidSelectionMessage',
    'renderOptions',
    'scrollToValue',
    'listRef',
    'listClass',
    'ref',
    'class',
    'style',
    'name',
    'onInvalid',
  ])
  const attributes = mergeProps(fieldAttributes(props), rest)
  const popup = createSelectionPopup()
  const { id, open, setOpen, present } = popup
  const [query, setQuery] = createValue(
    () => local.search?.query,
    () => '',
    (next) => local.search?.onQueryChange?.(next),
  )
  let field!: HTMLDivElement
  let trigger!: HTMLButtonElement
  let editor!: HTMLInputElement
  let mirror!: HTMLSelectElement

  const empty = { options: [] as readonly SelectionOption[], loading: false }
  const candidates = createMemo<typeof empty>((last) => {
    if (!present()) {
      return empty
    }
    if (!open()) {
      return last
    }
    const search = local.search
    if (search?.loading) {
      return { options: empty.options, loading: true }
    }
    const options = local.options
    const filter = search?.filter
    const searchText = query()
    const text = searchText.trim()
    if (!search || filter === false || (!filter && !text)) {
      return { options, loading: false }
    }
    const needle = text.toLocaleLowerCase()
    const matches = filter
      ? options.filter((option) => filter(option, searchText))
      : options.filter((option) => option.label.toLocaleLowerCase().includes(needle))
    return { options: matches, loading: false }
  }, empty)
  const collection = createSelection(() => candidates().options)
  createEffect(
    on(
      present,
      (visible) => {
        if (!visible && local.search) {
          setQuery('')
        }
      },
      { defer: true },
    ),
  )

  const selected = createMemo(() => new Map(local.selected.map((option) => [option.value, option])))
  const records = createMemo(() => Array.from(selected().values()))
  const keys = createMemo(() => Array.from(selected().keys()))
  const summary = () =>
    records()
      .map((option) => option.label)
      .join(', ') || local.placeholder

  const sync = () => {
    const values = new Set(keys())
    const defaults = new Set(local.defaults)
    for (const option of mirror.options) {
      option.defaultSelected = defaults.has(option.value)
      option.selected = values.has(option.value)
    }
    if (!local.chips && !values.size) {
      mirror.value = ''
    }
    mirror.setCustomValidity(
      records().some((option) => option.disabled) ? local.invalidSelectionMessage : '',
    )
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
    if (!local.chips) {
      setOpen(false)
      trigger.focus({ preventScroll: true })
    }
    local.onChoose(option)
  }
  const searchFocus = () => editor.focus({ preventScroll: true })
  return (
    <div
      ref={(node) => {
        field = node
      }}
      class={classes(input.surface, styles.container, local.class)}
      style={local.style}
      aria-invalid={attributes['aria-invalid']}
      data-open={open() || undefined}
      onFocusOut={(event) => {
        const next = event.relatedTarget
        if (next instanceof Node && !field.contains(next)) {
          setOpen(false)
        }
      }}
    >
      <SelectionTrigger
        {...attributes}
        popup={popup}
        collection={collection}
        selected={keys()}
        onChoose={choose}
        focusSearch={local.search ? searchFocus : undefined}
        aria-required={local.search ? undefined : (local.required ?? attributes.required)}
        aria-describedby={
          [attributes['aria-describedby'], local.search ? id + '-value' : undefined]
            .filter(Boolean)
            .join(' ') || undefined
        }
        ref={(node) => {
          trigger = node
          assignRef(local.ref, node)
        }}
        class={styles.trigger}
      >
        <span
          id={id + '-value'}
          class={
            local.chips && keys().length
              ? styles.summary
              : classes(styles.value, !keys().length ? styles.placeholder : undefined)
          }
        >
          {summary()}
        </span>
        <span class={styles.arrow} aria-hidden="true">
          <Icon path={local.search ? mdiUnfoldMoreHorizontal : mdiChevronDown} />
        </span>
      </SelectionTrigger>
      <Show when={local.chips && keys().length ? local.chips : undefined}>
        {(chips) => (
          <SelectedChips
            values={keys()}
            label={(key) => selected().get(key)?.label ?? key}
            disabled={attributes.disabled}
            panelId={popup.panelId}
            open={open()}
            field={() => field}
            removeLabel={chips().removeLabel}
            scrollPreviousLabel={chips().scrollPreviousLabel}
            scrollNextLabel={chips().scrollNextLabel}
            onRemove={chips().remove}
            focusTrigger={() => (local.search && open() ? searchFocus() : trigger.focus())}
          />
        )}
      </Show>
      <select
        ref={(node) => {
          mirror = node
        }}
        class={styles.submission}
        tabIndex={-1}
        aria-hidden="true"
        name={local.name}
        form={attributes.form}
        required={local.required ?? attributes.required}
        disabled={attributes.disabled}
        multiple={!!local.chips}
        onInvalid={local.onInvalid}
        onFocus={() => trigger.focus()}
      >
        <Show when={!local.chips}>
          <option value="" />
        </Show>
        <For each={records()}>
          {(option) => (
            <option value={option.value} disabled={option.disabled} selected>
              {option.label}
            </option>
          )}
        </For>
      </select>
      <SelectionList
        popup={popup}
        anchor={() => trigger}
        reference={() => field}
        collection={collection}
        selected={keys()}
        multiple={!!local.chips}
        onChoose={choose}
        label={attributes['aria-label']}
        labelledBy={attributes['aria-labelledby']}
        search={
          local.search
            ? {
                label: local.search.searchLabel,
                placeholder: local.search.searchPlaceholder,
                query: query(),
                change: setQuery,
                ref: (node) => {
                  editor = node
                },
              }
            : undefined
        }
        loading={candidates().loading}
        loadingMessage={local.search?.loadingMessage}
        emptyMessage={local.emptyMessage}
        renderOptions={local.renderOptions}
        scrollToValue={local.scrollToValue}
        listRef={local.listRef}
        listClass={local.listClass}
      />
    </div>
  )
}
