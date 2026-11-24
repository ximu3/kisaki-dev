import { printableKey } from '../../internal/typeahead'
import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { callHandler } from '../../internal/dom'
import { closeWhenUnavailable } from '../../internal/field'
import { optionId, type SelectionCollection } from './collection'
import type { SelectionOption } from './types'
import type { SelectionPopup } from './popup'

interface SelectionTriggerProps<
  O extends SelectionOption,
> extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  popup: SelectionPopup
  collection: SelectionCollection<O>
  selected: readonly string[]
  onChoose: (option: O) => void
}

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

  const onKeyDown: JSX.EventHandler<HTMLButtonElement, KeyboardEvent> = (event) => {
    callHandler(props.onKeyDown, event)
    if (event.defaultPrevented || event.isComposing) {
      return
    }

    const { popup, collection } = props
    const open = popup.open()
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault()
        if (open) {
          collection.move(event.key === 'ArrowDown' ? 1 : -1)
        } else {
          show()
        }
        return
      case 'Home':
      case 'End':
        if (open) {
          event.preventDefault()
          collection.move(event.key === 'Home' ? 'first' : 'last')
        }
        return
      case 'Enter':
      case ' ':
        if (open) {
          event.preventDefault()
          const active = collection.active()
          if (active !== undefined) {
            props.onChoose(collection.get(active)!)
          }
        }
        return
    }

    if (event.ctrlKey || event.altKey || event.metaKey || !printableKey(event.key)) {
      return
    }
    event.preventDefault()
    if (open) {
      collection.type(event.key, trigger)
    } else {
      show(event.key)
    }
  }

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
      onKeyDown={onKeyDown}
    />
  )
}
