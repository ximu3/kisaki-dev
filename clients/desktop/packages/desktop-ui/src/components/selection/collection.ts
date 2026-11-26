import { createMemo, createSignal, type Accessor } from 'solid-js'
import { createTypeahead } from '../../internal/typeahead'
import type { SelectionOption } from './types'

export function createSelection<O extends SelectionOption>(source: Accessor<readonly O[]>) {
  const options = createMemo(source)

  const entries = createMemo(
    () =>
      new Map<string, { option: O; position: number }>(
        options().map((option, index) => [option.value, { option, position: index + 1 }]),
      ),
  )
  const get = (value: string) => entries().get(value)?.option
  const positionOf = (value: string) => entries().get(value)?.position

  const enabled = createMemo(() => options().filter((option) => !option.disabled))

  const [highlighted, setHighlighted] = createSignal<string>()
  const active = () => {
    const key = highlighted()
    const option = key === undefined ? undefined : get(key)
    return option && !option.disabled ? option.value : undefined
  }

  const typeahead = createTypeahead()

  const highlight = (value: string | undefined) => setHighlighted(value)

  const move = (step: 1 | -1 | 'first' | 'last') => {
    const items = enabled()
    setHighlighted((previous) => {
      const current = items.findIndex((item) => item.value === previous)
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
      return items[index]?.value
    })
  }

  const type = (character: string, control: HTMLElement) => {
    const matches = typeahead(character, control)
    const items = enabled()
    setHighlighted((previous) => {
      const start = items.findIndex((option) => option.value === previous)
      const ordered = [...items.slice(start + 1), ...items.slice(0, start + 1)]
      return ordered.find((item) => matches(item.label))?.value ?? items[start]?.value
    })
  }

  return { options, get, positionOf, enabled, active, highlight, move, type }
}

export type SelectionCollection<O extends SelectionOption> = ReturnType<typeof createSelection<O>>

export function optionId(listId: string, value: string): string {
  return `${listId}-${encodeURIComponent(value)}`
}
