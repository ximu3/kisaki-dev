/** @fileoverview Selection buttons keep native focus while navigating a logical listbox. */

import { printableKey } from '../../internal/typeahead'
import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { callHandler } from '../../internal/dom'
import { closeWhenUnavailable } from '../../internal/field'
import { optionId } from './collection'
import type { SelectionCollection } from './collection'
import type { SelectionOption } from './types'
import type { SelectionPopup } from './popup'

/** Field-button attributes linked to popup disclosure, logical options and selection callbacks. */
interface SelectionTriggerProps<
  O extends SelectionOption,
> extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  popup: SelectionPopup
  collection: SelectionCollection<O>
  selected: readonly string[]
  /** Reports the active option chosen through trigger keyboard interaction. */
  onChoose: (option: O) => void
}

/**
 * Keeps focus on the trigger while browsing or committing logical options.
 *
 * The value owner decides whether choosing an option closes the list.
 */
export function SelectionTrigger<O extends SelectionOption>(
  props: SelectionTriggerProps<O>,
): JSX.Element {
  const rest = omit(
    props,
    'popup',
    'collection',
    'selected',
    'onChoose',
    'ref',
    'onClick',
    'onKeyDown',
  )
  let trigger!: HTMLButtonElement
  function show(character?: string) {
    props.popup.setOpen(true)
    queueMicrotask(() => {
      if (!props.popup.open()) {
        return
      }
      if (character) {
        props.collection.type(character, trigger)
      } else {
        const selected = props.selected.find((key) => {
          const option = props.collection.get(key)
          return option && !option.disabled
        })
        props.collection.highlight(selected ?? props.collection.enabled()[0]?.value)
      }
    })
  }
  closeWhenUnavailable(
    () => trigger,
    () => props.popup.setOpen(false),
  )

  return (
    <button
      {...rest}
      type="button"
      role="combobox"
      popovertarget={props.popup.panelId}
      aria-haspopup="listbox"
      aria-expanded={props.popup.open() ? 'true' : 'false'}
      aria-controls={props.popup.id}
      aria-activedescendant={
        props.popup.open() && props.collection.active() !== undefined
          ? optionId(props.popup.id, props.collection.active()!)
          : undefined
      }
      ref={[
        (node) => {
          trigger = node
        },
        props.ref,
      ]}
      onClick={(event) => {
        callHandler(props.onClick, event)
        if (!event.defaultPrevented) {
          event.preventDefault()
          if (props.popup.open()) {
            props.popup.setOpen(false)
          } else {
            show()
          }
        }
      }}
      onKeyDown={(event) => {
        callHandler(props.onKeyDown, event)
        if (event.defaultPrevented || event.isComposing) {
          return
        }

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          if (props.popup.open()) {
            props.collection.move(event.key === 'ArrowDown' ? 1 : -1)
          } else {
            show()
          }
        } else if (props.popup.open() && (event.key === 'Home' || event.key === 'End')) {
          event.preventDefault()
          props.collection.move(event.key === 'Home' ? 'first' : 'last')
        } else if (props.popup.open() && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          const key = props.collection.active()
          if (key !== undefined) {
            props.onChoose(props.collection.get(key)!)
          }
        } else if (
          !event.isComposing &&
          printableKey(event.key) &&
          !event.ctrlKey &&
          !event.altKey &&
          !event.metaKey
        ) {
          event.preventDefault()
          if (props.popup.open()) {
            props.collection.type(event.key, trigger)
          } else {
            show(event.key)
          }
        }
      }}
    />
  )
}
