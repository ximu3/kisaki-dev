/** @fileoverview Logical option navigation independent of mounted or virtualized rows. */

import { createMemo, createSignal, onCleanup } from 'solid-js'
import type { Accessor } from 'solid-js'
import type { SelectionOption } from './types'

export function createSelection(options: Accessor<readonly SelectionOption[]>) {
  const [highlighted, setHighlighted] = createSignal<string>()
  const enabled = createMemo(() => options().filter((option) => !option.disabled))
  const byValue = createMemo(() => new Map(options().map((option) => [option.value, option])))
  const active = () => {
    const option = byValue().get(highlighted() ?? '')
    return option && !option.disabled ? option.value : undefined
  }
  let search = ''
  let timer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(timer))

  const highlight = (value: string | undefined) => setHighlighted(value)
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

  return { active, highlight, move, type, byValue, enabled }
}

export type SelectionCollection = ReturnType<typeof createSelection>

/** Encode the stable identity once for both the active descendant and mounted row. */
export function optionId(listId: string, value: string): string {
  return `${listId}-${encodeURIComponent(value)}`
}
