import type { JSX } from '@solidjs/web'
import { SearchInput } from '../input/search/control'
import { FieldContext } from '../../internal/field'
import { optionId, type SelectionCollection } from './collection'
import type { SelectionOption } from './types'
import styles from './styles.module.css'

/** Search-editor labels and query ownership. */
export interface SearchState {
  label: string
  clearLabel: string
  placeholder: string | undefined
  query: string
  /** Requests a new query value from the search owner. */
  change: (query: string) => void
}

/** Search state linked to the logical candidate collection and its listbox identity. */
interface ComboboxSearchProps<O extends SelectionOption> {
  state: SearchState
  listId: string
  collection: SelectionCollection<O>
  open: boolean
  /** Commits the highlighted candidate from the query editor. */
  choose: (option: O) => void
}

/** Keeps editing focus in the query while coordinating candidate navigation and composition. */
export function ComboboxSearch<O extends SelectionOption>(
  props: ComboboxSearchProps<O>,
): JSX.Element {
  let composing = false

  function edit(query: string) {
    props.state.change(query)
    queueMicrotask(() => props.collection.highlight(props.collection.enabled()[0]?.value))
  }

  function navigate(event: KeyboardEvent) {
    if (composing || event.isComposing) {
      event.stopPropagation()
      return
    }
    if (event.defaultPrevented) {
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      props.collection.move(event.key === 'ArrowDown' ? 1 : -1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const key = props.collection.active()
      if (key !== undefined) {
        props.choose(props.collection.get(key)!)
      }
    }
  }

  return (
    <div class={styles.search}>
      <FieldContext value={null}>
        <SearchInput
          role="combobox"
          autocomplete="off"
          aria-label={props.state.label}
          placeholder={props.state.placeholder ?? props.state.label}
          clearLabel={props.state.clearLabel}
          aria-autocomplete="list"
          aria-controls={props.listId}
          aria-expanded={props.open ? 'true' : 'false'}
          aria-activedescendant={
            props.open && props.collection.active() !== undefined
              ? optionId(props.listId, props.collection.active()!)
              : undefined
          }
          value={props.state.query}
          onValueChange={(query) => {
            if (!composing) {
              edit(query)
            }
          }}
          onCompositionStart={() => {
            composing = true
          }}
          onCompositionEnd={(event) => {
            composing = false
            edit(event.currentTarget.value)
          }}
          onKeyDown={navigate}
        />
      </FieldContext>
    </div>
  )
}
