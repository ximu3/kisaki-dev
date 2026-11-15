/** @fileoverview Selection buttons keep native focus while navigating a logical listbox. */

import { printableKey } from '../typeahead'
import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, callHandler } from '../dom'
import { closeWhenUnavailable } from '../field'
import { optionId } from './collection'
import type { SelectionCollection } from './collection'
import type { SelectionOption } from './types'
import type { SelectionPopup } from './popup'

/** Field-button attributes linked to popup disclosure, logical options and selection callbacks. */
interface SelectionTriggerProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  popup: SelectionPopup
  collection: SelectionCollection
  selected: readonly string[]
  /** Reports the active option chosen through trigger keyboard interaction. */
  onChoose: (option: SelectionOption) => void
  /** Moves focus into the popup's search editor when searchable interaction is enabled. */
  focusSearch?: (() => void) | undefined
}

/**
 * Renders a field trigger and routes keyboard interaction to logical options or the search editor.
 *
 * The value owner decides whether choosing an option closes the list.
 */
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
  /** Opens the popup and highlights an enabled selected option or the first enabled candidate. */
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
          !event.isComposing &&
          printableKey(event.key) &&
          !event.ctrlKey &&
          !event.altKey &&
          !event.metaKey
        ) {
          event.preventDefault()
          if (!local.popup.open()) {
            show()
          }
          local.collection.type(event.key, event.currentTarget)
        }
      }}
    />
  )
}
