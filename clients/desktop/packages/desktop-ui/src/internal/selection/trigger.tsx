/** @fileoverview Selection buttons keep native focus while navigating a logical listbox. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, callHandler } from '../dom'
import { closeWhenUnavailable } from '../field'
import { optionId } from './collection'
import type { SelectionCollection } from './collection'
import type { SelectionOption } from './types'
import type { SelectionPopup } from './popup'

interface SelectionTriggerProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  popup: SelectionPopup
  collection: SelectionCollection
  selected: readonly string[]
  onChoose: (option: SelectionOption) => void
  focusSearch?: (() => void) | undefined
}

/** Use with SelectionList. The owner decides whether a choice closes the list. */
export function SelectionTrigger(props: SelectionTriggerProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'popup',
    'collection',
    'selected',
    'onChoose',
    'focusSearch',
    'ref',
    'onClick',
    'onKeyDown',
  ])
  let trigger!: HTMLButtonElement
  const show = () => {
    local.popup.setOpen(true)
    const selected = local.selected.find((key) => {
      const item = local.collection.get(key)
      return item && !item.disabled
    })
    local.collection.highlight(selected ?? local.collection.enabled()[0]?.value)
  }
  closeWhenUnavailable(
    () => trigger,
    () => local.popup.setOpen(false),
  )

  return (
    <button
      {...rest}
      type="button"
      role={local.focusSearch ? undefined : 'combobox'}
      popovertarget={local.popup.panelId}
      aria-haspopup={local.focusSearch ? 'dialog' : 'listbox'}
      aria-expanded={local.popup.open()}
      aria-controls={local.focusSearch ? local.popup.panelId : local.popup.id}
      aria-activedescendant={
        !local.focusSearch && local.popup.open() && local.collection.active() !== undefined
          ? optionId(local.popup.id, local.collection.active()!)
          : undefined
      }
      ref={(node) => {
        trigger = node
        assignRef(local.ref, node)
      }}
      onClick={(event) => {
        callHandler(local.onClick, event)
        if (!event.defaultPrevented) {
          event.preventDefault()
          if (local.popup.open()) {
            local.popup.setOpen(false)
          } else {
            show()
          }
        }
      }}
      onKeyDown={(event) => {
        callHandler(local.onKeyDown, event)
        if (event.defaultPrevented || event.isComposing) {
          return
        }

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          if (local.popup.open() && local.focusSearch) {
            local.focusSearch()
          } else if (local.popup.open()) {
            local.collection.move(event.key === 'ArrowDown' ? 1 : -1)
          } else {
            show()
          }
        } else if (local.focusSearch) {
          return
        } else if (local.popup.open() && (event.key === 'Home' || event.key === 'End')) {
          event.preventDefault()
          local.collection.move(event.key === 'Home' ? 'first' : 'last')
        } else if (local.popup.open() && (event.key === 'Enter' || event.key === ' ')) {
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
          if (!local.popup.open()) {
            show()
          }
          local.collection.type(event.key)
        }
      }}
    />
  )
}
