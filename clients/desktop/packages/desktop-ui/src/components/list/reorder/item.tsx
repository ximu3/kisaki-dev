/** @fileoverview Registers a row handle and the insertion target of its owning list. */

import { createEffect, For, onCleanup, Show, splitProps } from 'solid-js'
import {
  attachClosestEdge,
  extractClosestEdge,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import { assignRef } from '../../../internal/dom'
import { createDraggable, createDropTarget } from '../../drag/adapter'
import { DragHandle, DropIndicator } from '../../drag/presentation'
import { setDragPreview } from '../../drag/preview'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../../menu/parts'
import { ListItem, type ListItemProps } from '../parts'
import { useReorderableList, type MoveCommand } from './control'

/** Commands appear in their corresponding order in the item's move menu. */
const commands = ['first', 'previous', 'next', 'last'] as const satisfies readonly MoveCommand[]

/** Row appearance together with its stable ID and localized pointer and keyboard labels. */
export interface ReorderableListItemProps extends Omit<ListItemProps, 'handle'> {
  value: string
  moveLabel: string
  previewLabel: string
}

/** Composes one native ListItem with a move menu, keyboard shortcut and pointer target. */
export function ReorderableListItem(props: ReorderableListItemProps) {
  const list = useReorderableList()
  const [local, rest] = splitProps(props, ['value', 'moveLabel', 'previewLabel', 'ref', 'children'])
  let row!: HTMLLIElement
  let handle!: HTMLButtonElement

  createEffect(() => {
    const id = local.value
    list.handleById.set(id, handle)
    onCleanup(() => list.handleById.delete(id))
  })
  createDraggable(() => ({
    element: handle,
    canDrag: () => !list.busy(),
    getInitialData: () => ({ list: list.scope, id: local.value, ids: list.subjects(local.value) }),
    onGenerateDragPreview: ({ nativeSetDragImage }) =>
      setDragPreview({ nativeSetDragImage, label: local.previewLabel }),
  }))
  createDropTarget(() => ({
    element: row,
    canDrop: ({ source, element, input }) => {
      if (list.busy() || source.data.list !== list.scope) {
        return false
      }
      const edge = extractClosestEdge(
        attachClosestEdge({}, { element, input, allowedEdges: ['top', 'bottom'] }),
      )
      return (
        !!edge &&
        list.canSubmit({
          ids: source.data.ids as readonly string[],
          targetId: local.value,
          edge: edge === 'top' ? 'before' : 'after',
        })
      )
    },
    getData: ({ element, input }) =>
      attachClosestEdge(
        { list: list.scope, id: local.value },
        { element, input, allowedEdges: ['top', 'bottom'] },
      ),
  }))

  function move(command: MoveCommand) {
    list.submit(local.value, list.command(local.value, command))
  }

  const edge = (): 'top' | 'bottom' | undefined => {
    const drop = list.drop()
    if (drop?.targetId === local.value) {
      return drop.edge === 'before' ? 'top' : 'bottom'
    }
  }

  return (
    <ListItem
      {...rest}
      ref={(node) => {
        row = node
        assignRef(local.ref, node)
      }}
      handle={
        <Menu>
          <DragHandle
            as={MenuTrigger}
            ref={(node) => {
              handle = node
            }}
            aria-label={local.moveLabel}
            onMove={move}
          />
          <MenuContent>
            <For each={commands}>
              {(command) => (
                <MenuItem
                  disabled={!list.command(local.value, command)}
                  onSelect={() => move(command)}
                >
                  {list.labels()[command]}
                </MenuItem>
              )}
            </For>
          </MenuContent>
        </Menu>
      }
    >
      {local.children}
      <Show when={edge()}>
        {(side) => <DropIndicator edge={side()} gap="var(--kui-list-gap)" />}
      </Show>
    </ListItem>
  )
}
