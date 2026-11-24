import { createEffect, For, Show, omit } from 'solid-js'
import {
  attachClosestEdge,
  extractClosestEdge,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import { createDraggable, createDropTarget } from '../../drag/adapter'
import { DragHandle, DropIndicator } from '../../drag/presentation'
import { setDragPreview } from '../../drag/preview'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../../menu'
import { ListItem, type ListItemProps } from '../parts'
import { useReorderableList, type MoveCommand } from './control'

const commands = ['first', 'previous', 'next', 'last'] as const satisfies readonly MoveCommand[]

export interface ReorderableListItemProps extends Omit<ListItemProps, 'handle'> {
  value: string
  moveLabel: string
  previewLabel: string
}

export function ReorderableListItem(props: ReorderableListItemProps) {
  const list = useReorderableList()
  const rest = omit(props, 'value', 'moveLabel', 'previewLabel', 'ref', 'children')
  let row!: HTMLLIElement
  let handle!: HTMLButtonElement

  createEffect(
    () => props.value,
    (id) => {
      list.handleById.set(id, handle)

      return () => list.handleById.delete(id)
    },
  )
  createDraggable(() => ({
    element: handle,
    canDrag: () => !list.busy(),
    getInitialData: () => ({ list: list.scope, id: props.value, ids: list.subjects(props.value) }),
    onGenerateDragPreview: ({ nativeSetDragImage }) =>
      setDragPreview({ nativeSetDragImage, label: props.previewLabel }),
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
          targetId: props.value,
          edge: edge === 'top' ? 'before' : 'after',
        })
      )
    },
    getData: ({ element, input }) =>
      attachClosestEdge(
        { list: list.scope, id: props.value },
        { element, input, allowedEdges: ['top', 'bottom'] },
      ),
  }))

  function move(command: MoveCommand) {
    list.submit(props.value, list.command(props.value, command))
  }

  const edge = (): 'top' | 'bottom' | undefined => {
    const drop = list.drop()
    if (drop?.targetId === props.value) {
      return drop.edge === 'before' ? 'top' : 'bottom'
    }
  }

  return (
    <ListItem
      {...rest}
      ref={[
        (node) => {
          row = node
        },
        props.ref,
      ]}
      handle={
        <Menu>
          <DragHandle
            as={MenuTrigger}
            ref={(node) => {
              handle = node
            }}
            aria-label={props.moveLabel}
            onMove={move}
          />
          <MenuContent>
            <For each={commands}>
              {(command) => (
                <MenuItem
                  disabled={!list.command(props.value, command)}
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
      {props.children}
      <Show when={edge()}>
        {(side) => <DropIndicator edge={side()} gap="var(--kui-list-gap)" />}
      </Show>
    </ListItem>
  )
}
