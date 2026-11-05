/** @fileoverview Pointer handles and keyboard actions produce the same stable move intent. */

import { createEffect, For, Show, type JSX } from 'solid-js'
import { DropdownMenu, MenuItem } from '../menu'
import type { DragController, DropEdge, MoveTarget } from './controller'

export interface DragHandleProps {
  controller: DragController
  itemId: string
  label: string
  disabled?: boolean
  /** Localized moves such as up, down, first and last, resolved against the host's real order. */
  moves: readonly (MoveTarget & { label: string })[]
  children: JSX.Element
}

/** Only this button starts dragging. Click or use the keyboard to open its equivalent actions. */
export function DragHandle(props: DragHandleProps): JSX.Element {
  let handle!: HTMLButtonElement
  createEffect(() =>
    props.controller.source(
      () => handle,
      () => (props.disabled ? undefined : props.itemId),
    ),
  )

  return (
    <DropdownMenu
      label={props.label}
      trigger={props.children}
      triggerProps={{
        ref: (el) => {
          handle = el
        },
        variant: 'ghost',
        size: 'icon-sm',
        'aria-label': props.label,
        disabled: props.disabled,
        class: 'cursor-grab active:cursor-grabbing',
      }}
    >
      <For each={props.moves}>
        {(target) => (
          <MenuItem
            disabled={!props.controller.canMove(props.itemId, target)}
            onSelect={() => props.controller.move(props.itemId, target)}
          >
            {target.label}
          </MenuItem>
        )}
      </For>
    </DropdownMenu>
  )
}

/** Place in a relatively positioned target. Only the current eligible edge is drawn. */
export function DropIndicator(props: { edge: DropEdge | undefined }): JSX.Element {
  const positions = {
    top: 'inset-x-0 top-0 h-0.5',
    bottom: 'inset-x-0 bottom-0 h-0.5',
    left: 'inset-y-0 left-0 w-0.5',
    right: 'inset-y-0 right-0 w-0.5',
  }
  return (
    <Show when={props.edge}>
      {(edge) => (
        <span
          aria-hidden="true"
          class={'pointer-events-none absolute bg-primary ' + positions[edge()]}
        />
      )}
    </Show>
  )
}
