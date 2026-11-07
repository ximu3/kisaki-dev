/** @fileoverview Selection buttons keep native focus while navigating a logical listbox. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, callHandler } from '../dom'
import { closeWhenUnavailable } from '../field'
import { optionId } from './collection'
import type { SelectionCollection } from './collection'
import type { SelectionOption } from './types'

interface SelectionTriggerProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  listId: string
  collection: SelectionCollection
  selected: readonly string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onChoose: (option: SelectionOption) => void
}

/** Use with SelectionList. The owner decides whether a choice closes the list. */
export function SelectionTrigger(props: SelectionTriggerProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'listId',
    'collection',
    'selected',
    'open',
    'onOpenChange',
    'onChoose',
    'ref',
    'onClick',
    'onKeyDown',
    'onBlur',
  ])
  let trigger!: HTMLButtonElement
  const show = () => {
    local.onOpenChange(true)
    const selected = local.selected.find((key) => {
      const item = local.collection.get(key)
      return item && !item.disabled
    })
    local.collection.highlight(selected ?? local.collection.enabled()[0]?.value)
  }
  closeWhenUnavailable(
    () => trigger,
    () => local.onOpenChange(false),
  )

  return (
    <button
      {...rest}
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={local.open}
      aria-controls={local.listId}
      aria-activedescendant={
        local.open && local.collection.active() !== undefined
          ? optionId(local.listId, local.collection.active()!)
          : undefined
      }
      ref={(node) => {
        trigger = node
        assignRef(local.ref, node)
      }}
      onClick={(event) => {
        callHandler(local.onClick, event)
        if (!event.defaultPrevented) {
          if (local.open) {
            local.onOpenChange(false)
          } else {
            show()
          }
        }
      }}
      onBlur={(event) => {
        local.onOpenChange(false)
        callHandler(local.onBlur, event)
      }}
      onKeyDown={(event) => {
        callHandler(local.onKeyDown, event)
        if (event.defaultPrevented || event.isComposing) {
          return
        }

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          if (local.open) {
            local.collection.move(event.key === 'ArrowDown' ? 1 : -1)
          } else {
            show()
          }
        } else if (local.open && (event.key === 'Home' || event.key === 'End')) {
          event.preventDefault()
          local.collection.move(event.key === 'Home' ? 'first' : 'last')
        } else if (local.open && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          const key = local.collection.active()
          if (key !== undefined) {
            local.onChoose(local.collection.get(key)!)
          }
        } else if (
          event.key.length === 1 &&
          event.key !== ' ' &&
          !event.ctrlKey &&
          !event.altKey &&
          !event.metaKey
        ) {
          event.preventDefault()
          if (!local.open) {
            show()
          }
          local.collection.type(event.key)
        }
      }}
    />
  )
}
