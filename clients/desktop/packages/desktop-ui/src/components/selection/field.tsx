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
import { assignRef, classes, createElementRef } from '../../internal/dom'
import type { ControlSize } from '../../internal/control/size'
import { useContext } from 'solid-js'
import { FormContext } from '../../internal/form'
import { fieldAttributes } from '../../internal/field'
import { Icon, ChevronDown, ChevronsUpDown } from '../../internal/icon/glyph'
import { createValue, onFormReset } from '../../internal/state'
import { SelectedChips, type ChipLabels } from '../../internal/chips/control'
import { createSelection } from './collection'
import { SelectionList } from './list'
import { SelectionTrigger } from './trigger'
import { createSelectionPopup } from './popup'
import type { SelectionListProps, SelectionOption } from './types'
import input from '../../internal/input-surface.module.css'
import styles from './field.module.css'

/** Shared field-trigger, option-list and native form-validation props for choice controls. */
export interface ChoiceFieldProps<O extends SelectionOption = SelectionOption>
  extends
    Omit<
      JSX.ButtonHTMLAttributes<HTMLButtonElement>,
      'value' | 'children' | 'type' | 'onChange' | 'onInvalid'
    >,
    SelectionListProps<O> {
  options: readonly O[]
  /** Sizes the closed field and its affordances independently of the option list. */
  size?: ControlSize | undefined
  placeholder?: string
  emptyMessage: JSX.Element
  invalidSelectionMessage: string
  required?: boolean
  /** Handles the validation event from the native submission select. */
  onInvalid?: JSX.SelectHTMLAttributes<HTMLSelectElement>['onInvalid']
}

/**
 * Search-query ownership and result presentation for a choice field.
 *
 * The host may supply prefiltered or asynchronous options with filter=false.
 */
export interface ChoiceSearchProps<O extends SelectionOption = SelectionOption> {
  searchLabel: string
  clearSearchLabel: string
  searchPlaceholder?: string
  query?: string
  /** Reports query edits and requests an empty query after popup presentation ends. */
  onQueryChange?: (query: string) => void
  /**
   * Tests an option against the raw query for custom local filtering.
   *
   * False delegates filtering to the host; omission uses case-folded substring matching.
   */
  filter?: false | ((option: O, query: string) => boolean)
  loading?: boolean
  loadingMessage: JSX.Element
}

/** Committed records and wrapper callbacks connected to the shared choice-field presentation. */
interface SelectionFieldProps<O extends SelectionOption> extends ChoiceFieldProps<O> {
  selected: readonly O[]
  defaults: readonly string[]
  chips?: ChipLabels & {
    /** Requests removal of a committed chip by its stable key. */
    remove: (key: string) => void
  }
  search?: ChoiceSearchProps<O>
  /** Reports the chosen record to the value-owning wrapper. */
  onChoose: (option: O) => void
  /** Requests restoration of the wrapper's default selection after an accepted form reset. */
  onReset: () => void
}

/**
 * Renders committed choices and optional search while connecting popup interaction to native form
 * submission.
 *
 * Selected records survive query changes; unavailable committed choices remain visible and
 * invalidate submission.
 */
export function SelectionField<O extends SelectionOption>(
  props: SelectionFieldProps<O>,
): JSX.Element {
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
    'virtual',
    'scrollToValue',
    'listRef',
    'listClass',
    'size',
    'ref',
    'class',
    'style',
    'name',
    'onInvalid',
  ])
  const form = useContext(FormContext)
  const attributes = mergeProps(fieldAttributes(props), rest)
  const popup = createSelectionPopup()
  const { id, open, setOpen, present } = popup
  const [query, setQuery] = createValue(
    () => local.search?.query,
    () => '',
    (next) => local.search?.onQueryChange?.(next),
  )
  const [trigger, bindTrigger] = createElementRef<HTMLButtonElement>()
  let field!: HTMLDivElement
  let mirror!: HTMLSelectElement

  const empty = { options: [] as readonly O[], loading: false }
  /**
   * Visible candidate records retained through exit, with loading distinct from an empty result.
   */
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

  /**
   * Synchronizes selected and default options and marks disabled committed records invalid on the
   * native select.
   */
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
  onMount(() =>
    createEffect(() => {
      sync()
      form?.refresh()
    }),
  )
  const flushReset = onFormReset(
    () => mirror,
    () => {
      local.onReset()
      untrack(sync)
      setOpen(false)
    },
  )

  /**
   * Closes and refocuses a single-choice popup before forwarding its chosen record; multiple-choice
   * lists stay open.
   */
  const choose = (option: O) => {
    flushReset()
    if (!local.chips) {
      setOpen(false)
      trigger()?.focus({ preventScroll: true })
    }
    local.onChoose(option)
  }
  return (
    <div
      ref={(node) => {
        field = node
      }}
      class={classes(input.surface, styles.container, local.class)}
      style={local.style}
      data-size={local.size ?? 'default'}
      aria-invalid={attributes['aria-invalid']}
      onFocusOut={(event) => {
        const next = event.relatedTarget
        if (next instanceof Node && !field.contains(next)) {
          setOpen(false)
        }
      }}
    >
      <SelectionTrigger
        {...attributes}
        data-focus-anchor
        popup={popup}
        collection={collection}
        selected={keys()}
        onChoose={choose}
        aria-required={local.required ?? attributes.required}
        aria-describedby={
          [attributes['aria-describedby'], local.search ? id + '-value' : undefined]
            .filter(Boolean)
            .join(' ') || undefined
        }
        ref={(node) => {
          bindTrigger(node)
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
          <Icon icon={local.search ? ChevronsUpDown : ChevronDown} />
        </span>
      </SelectionTrigger>
      <Show when={local.chips && keys().length ? local.chips : undefined}>
        {(chips) => (
          <SelectedChips
            values={keys()}
            label={(key) => selected().get(key)?.label ?? key}
            disabled={attributes.disabled}
            panelId={open() ? popup.panelId : undefined}
            field={() => field}
            removeLabel={chips().removeLabel}
            scrollPreviousLabel={chips().scrollPreviousLabel}
            scrollNextLabel={chips().scrollNextLabel}
            onRemove={(key) => {
              flushReset()
              chips().remove(key)
            }}
            focusTrigger={() => trigger()?.focus({ preventScroll: true })}
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
        onFocus={() => trigger()?.focus()}
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
        anchor={trigger}
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
                clearLabel: local.search.clearSearchLabel,
                placeholder: local.search.searchPlaceholder,
                query: query(),
                change: setQuery,
              }
            : undefined
        }
        loading={candidates().loading}
        loadingMessage={local.search?.loadingMessage}
        emptyMessage={local.emptyMessage}
        virtual={local.virtual}
        renderOptions={local.renderOptions}
        scrollToValue={local.scrollToValue}
        listRef={local.listRef}
        listClass={local.listClass}
      />
    </div>
  )
}
