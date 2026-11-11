/** @fileoverview The popup editor keeps native input focus while navigating the candidate list. */

import { createEffect, onMount } from 'solid-js'
import type { JSX } from 'solid-js'
import { Icon, mdiMagnify } from '../icon/glyph'
import { optionId } from './collection'
import type { SelectionCollection } from './collection'
import type { SelectionOption } from './types'
import styles from './styles.module.css'

export interface SearchState {
  label: string
  placeholder: string | undefined
  query: string
  change: (query: string) => void
  ref: (node: HTMLInputElement) => void
}

interface SearchProps {
  state: SearchState
  listId: string
  collection: SelectionCollection
  open: boolean
  choose: (option: SelectionOption) => void
}

export function SearchInput(props: SearchProps): JSX.Element {
  let input!: HTMLInputElement
  let composing = false

  const edit = () => {
    props.state.change(input.value)
    if (input.value !== props.state.query) {
      input.value = props.state.query
    }
    props.collection.highlight(props.collection.enabled()[0]?.value)
  }
  onMount(() =>
    createEffect(() => {
      const query = props.state.query
      if (!composing && input.value !== query) {
        input.value = query
      }
    }),
  )

  return (
    <div class={styles.search}>
      <Icon path={mdiMagnify} />
      <input
        ref={(node) => {
          input = node
          props.state.ref(node)
        }}
        type="text"
        role="combobox"
        autocomplete="off"
        autofocus
        aria-label={props.state.label}
        placeholder={props.state.placeholder ?? props.state.label}
        aria-autocomplete="list"
        aria-controls={props.listId}
        aria-expanded={props.open}
        aria-activedescendant={
          props.open && props.collection.active() !== undefined
            ? optionId(props.listId, props.collection.active()!)
            : undefined
        }
        onCompositionStart={() => {
          composing = true
        }}
        onCompositionEnd={() => {
          composing = false
          edit()
        }}
        onInput={() => {
          if (!composing) {
            edit()
          }
        }}
        on:keydown={(event) => {
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
            const option = key === undefined ? undefined : props.collection.get(key)
            if (option) {
              props.choose(option)
            }
          }
        }}
      />
    </div>
  )
}
