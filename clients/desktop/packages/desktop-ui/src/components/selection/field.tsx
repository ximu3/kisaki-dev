import { createMemo, For, merge, createEffect, Show, omit, createSignal } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { classes } from '../../internal/dom'
import type { ControlSize } from '../../internal/control/size'
import { nativeValidityChanged } from '../../internal/form'
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
  const rest = omit(
    props,
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
  )

  const attributes = merge(fieldAttributes(props), rest)
  const popup = createSelectionPopup()
  const { id, open, setOpen, present } = popup
  const [query, setQuery] = createValue(
    () => props.search?.query,
    () => '',
    (next) => props.search?.onQueryChange?.(next),
  )
  const [trigger, bindTrigger] = createSignal<HTMLButtonElement>()
  let field!: HTMLDivElement

  const empty = { options: [] as readonly O[], loading: false }
  // Keep the last list available to the closing animation.
  const candidates = createMemo<typeof empty>((last = empty) => {
    if (!present()) {
      return empty
    }
    if (!open()) {
      return last
    }
    const search = props.search
    if (search?.loading) {
      return { options: empty.options, loading: true }
    }
    const options = props.options
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
  })
  const collection = createSelection(() => candidates().options)
  createEffect(
    present,
    (visible) => {
      if (!visible && props.search) {
        setQuery('')
      }
    },
    { defer: true },
  )

  const selected = createMemo(() => new Map(props.selected.map((option) => [option.value, option])))
  const records = createMemo(() => Array.from(selected().values()))
  const keys = createMemo(() => Array.from(selected().keys()))
  const summary = () =>
    records()
      .map((option) => option.label)
      .join(', ') || props.placeholder

  let submission!: HTMLSelectElement
  const nativeSelection = createMemo(() => ({
    values: new Set(keys()),
    defaults: new Set(props.defaults),
    multiple: !!props.chips,
    message: records().some((option) => option.disabled) ? props.invalidSelectionMessage : '',
  }))
  const sync = (state: ReturnType<typeof nativeSelection>) => {
    for (const option of submission.options) {
      option.defaultSelected = state.defaults.has(option.value)
      option.selected = state.values.has(option.value)
    }
    if (!state.multiple && !state.values.size) {
      submission.value = ''
    }
    submission.setCustomValidity(state.message)
    nativeValidityChanged(submission.form)
  }
  createEffect(nativeSelection, sync)
  const flushReset = onFormReset(
    () => submission,
    () => {
      props.onReset()
      queueMicrotask(() => sync(nativeSelection()))
      setOpen(false)
    },
  )

  // Return focus before giving single-choice handlers a chance to remove the popup.
  const choose = (option: O) => {
    flushReset()
    if (!props.chips) {
      setOpen(false)
      trigger()?.focus({ preventScroll: true })
    }
    props.onChoose(option)
  }

  return (
    <div
      ref={(node) => {
        field = node
      }}
      class={[input.surface, styles.container, props.class]}
      data-control-key={props.name || attributes.id || id}
      style={props.style}
      data-size={props.size ?? 'default'}
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
        aria-required={(props.required ?? attributes.required) ? 'true' : undefined}
        aria-describedby={
          [attributes['aria-describedby'], props.search ? id + '-value' : undefined]
            .filter(Boolean)
            .join(' ') || undefined
        }
        ref={[bindTrigger, props.ref]}
        class={styles.trigger}
      >
        <span
          id={id + '-value'}
          class={
            props.chips && keys().length
              ? styles.summary
              : classes(styles.value, !keys().length ? styles.placeholder : undefined)
          }
        >
          {summary()}
        </span>
        <span class={styles.arrow} aria-hidden="true">
          <Icon icon={props.search ? ChevronsUpDown : ChevronDown} />
        </span>
      </SelectionTrigger>
      <Show when={props.chips && keys().length ? props.chips : undefined}>
        {(chips) => (
          <SelectedChips
            values={keys()}
            label={(key) => selected().get(key)?.label ?? key}
            disabled={!!attributes.disabled}
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
          submission = node
        }}
        class={styles.submission}
        tabindex={-1}
        aria-hidden="true"
        name={props.name}
        form={attributes.form}
        required={props.required ?? attributes.required}
        disabled={attributes.disabled}
        multiple={!!props.chips}
        onInvalid={props.onInvalid}
        onFocus={() => trigger()?.focus()}
      >
        <Show when={!props.chips}>
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
        multiple={!!props.chips}
        onChoose={choose}
        label={attributes['aria-label'] || undefined}
        labelledBy={attributes['aria-labelledby'] || undefined}
        search={
          props.search
            ? {
                label: props.search.searchLabel,
                clearLabel: props.search.clearSearchLabel,
                placeholder: props.search.searchPlaceholder,
                query: query(),
                change: setQuery,
              }
            : undefined
        }
        loading={candidates().loading}
        loadingMessage={props.search?.loadingMessage}
        emptyMessage={props.emptyMessage}
        virtual={props.virtual}
        renderOptions={props.renderOptions}
        scrollToValue={props.scrollToValue}
        listRef={props.listRef}
        listClass={props.listClass}
      />
    </div>
  )
}
