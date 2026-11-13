/** @fileoverview Logical option navigation independent of mounted or virtualized rows. */

import { createMemo, createSignal, onCleanup } from 'solid-js'
import type { Accessor } from 'solid-js'
import type { SelectionOption } from './types'

/**
 * Creates a reactive logical option collection independent of mounted rows.
 *
 * Navigation uses enabled stable keys, and owner cleanup clears the typeahead timer.
 */
export function createSelection(source: Accessor<readonly SelectionOption[]>) {
  /** Reactive snapshot of the current option source. */
  const options = createMemo(source)
  /** Option records indexed by stable value with their one-based collection positions. */
  const entries = createMemo(
    () =>
      new Map(options().map((option, index) => [option.value, { option, position: index + 1 }])),
  )
  /** Looks up the current option record by its stable value key. */
  const get = (value: string) => entries().get(value)?.option
  /** Reads an option's one-based position in the complete supplied collection. */
  const positionOf = (value: string) => entries().get(value)?.position
  /** Current options available for keyboard selection. */
  const enabled = createMemo(() => options().filter((option) => !option.disabled))

  /** Highlighted option identity maintained independently from the selected values. */
  const [highlighted, setHighlighted] = createSignal<string>()
  /** Returns the highlighted key only while its current option exists and is enabled. */
  const active = () => {
    const option = get(highlighted() ?? '')
    return option && !option.disabled ? option.value : undefined
  }

  let search = ''
  let timer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(timer))

  /** Sets the logical highlighted key, or clears it when undefined is supplied. */
  const highlight = (value: string | undefined) => setHighlighted(value)
  /**
   * Moves highlight among enabled options with wrapping and explicit first or last destinations.
   */
  const move = (step: 1 | -1 | 'first' | 'last') => {
    const items = enabled()
    const current = items.findIndex((item) => item.value === active())
    let index: number
    if (step === 'first') {
      index = 0
    } else if (step === 'last') {
      index = items.length - 1
    } else if (current < 0) {
      index = step === 1 ? 0 : items.length - 1
    } else {
      index = (current + step + items.length) % items.length
    }
    highlight(items[index]?.value)
  }
  /**
   * Extends timed label-prefix search and cycles matching options after the current highlight.
   *
   * No match preserves the current active choice.
   */
  const type = (character: string) => {
    clearTimeout(timer)
    search += character.toLocaleLowerCase()
    timer = setTimeout(() => {
      search = ''
    }, 700)
    const repeated = [...search].every((letter) => letter === search[0])
    const prefix = repeated ? character.toLocaleLowerCase() : search
    const items = enabled()
    const start = items.findIndex((option) => option.value === active())
    const ordered = [...items.slice(start + 1), ...items.slice(0, start + 1)]
    highlight(
      ordered.find((item) => item.label.toLocaleLowerCase().startsWith(prefix))?.value ?? active(),
    )
  }

  return { options, get, positionOf, enabled, active, highlight, move, type }
}

/** Reactive option lookup, logical positions, highlight and navigation operations. */
export type SelectionCollection = ReturnType<typeof createSelection>

/**
 * Encodes a stable option key into the DOM identity shared by its row and active-descendant
 * reference.
 */
export function optionId(listId: string, value: string): string {
  return `${listId}-${encodeURIComponent(value)}`
}
