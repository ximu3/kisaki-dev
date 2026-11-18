/** @fileoverview Coordinates one controlled ordered list and its input-independent move requests. */

import { createContext, createSignal, onCleanup, splitProps, useContext } from 'solid-js'
import type { ElementEventBasePayload } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import { assignRef } from '../../../internal/dom'
import { createDragAutoScroll, createDragMonitor } from '../../drag/adapter'
import { DragFeedback } from '../../drag/presentation'
import { List, type ListProps } from '../parts'
import { moveListItems, type ListMove } from './move'

/** Navigation commands available from the move menu and keyboard. */
export type MoveCommand = 'first' | 'previous' | 'next' | 'last'

/** Localized commands and the announcement of an adopted move. */
export interface ReorderLabels {
  first: string
  previous: string
  next: string
  last: string
  /** Formats the source item and its one-based position after the move. */
  moved: (sourceId: string, position: number, move: ListMove) => string
}

/** Host-owned visible order, permissions and adoption for one ordered list. */
export interface ReorderableListProps extends Omit<ListProps, 'ordered'> {
  /** Stable unique item IDs in logical display order. */
  order: readonly string[]
  selected?: ReadonlySet<string>
  labels: ReorderLabels
  /** Returns the actual scrolling element when an ancestor owns the viewport. */
  viewport?: () => HTMLElement | undefined
  /** Determines whether a move within the current display range is available. */
  canMove?: (move: ListMove) => boolean
  /** Adopts the request and exposes the committed or staged order before resolving. */
  onMove: (move: ListMove) => void | Promise<void>
  /** Presents the host-owned failure when adoption rejects. */
  onMoveError: (reason: unknown) => void
}

/** Pointer lifetimes distinguish independent lists and retain the source identity during a drag. */
const ReorderContext = createContext<{
  readonly scope: symbol
  readonly busy: () => boolean
  readonly labels: () => ReorderLabels
  readonly handleById: Map<string, HTMLButtonElement>
  readonly drop: () => ListMove | undefined
  readonly subjects: (id: string) => readonly string[]
  readonly command: (id: string, command: MoveCommand) => ListMove | undefined
  readonly canSubmit: (move: ListMove) => boolean
  readonly submit: (sourceId: string, move: ListMove | undefined) => void
}>()

/** Installs one drag monitor, autoscroll owner and adoption gate for the ordered list. */
export function ReorderableList(props: ReorderableListProps) {
  const [local, rest] = splitProps(props, [
    'order',
    'selected',
    'labels',
    'viewport',
    'canMove',
    'onMove',
    'onMoveError',
    'ref',
  ])
  const [busy, setBusy] = createSignal(false)
  const [drop, setDrop] = createSignal<ListMove>()
  const [feedback, setFeedback] = createSignal('')
  const scope = Symbol()
  const handleById = new Map<string, HTMLButtonElement>()
  let list!: HTMLUListElement | HTMLOListElement
  onCleanup(() => handleById.clear())

  function subjects(id: string) {
    const selected = local.selected
    return selected?.has(id) ? local.order.filter((item) => selected.has(item)) : [id]
  }

  function canSubmit(move: ListMove) {
    const order = local.order
    return !busy() && moveListItems(order, move) !== order && (local.canMove?.(move) ?? true)
  }

  function command(id: string, direction: MoveCommand) {
    const order = local.order
    const ids = subjects(id)
    const selected = new Set(ids)
    const first = order.indexOf(ids[0]!)
    const last = order.indexOf(ids.at(-1)!)
    const before = direction === 'first' || direction === 'previous'
    let range = order
    if (direction === 'previous') {
      range = order.slice(0, first)
    } else if (direction === 'next') {
      range = order.slice(last + 1)
    }
    const candidates = range.filter((item) => !selected.has(item))
    const targetId =
      direction === 'first' || direction === 'next' ? candidates[0] : candidates.at(-1)
    const move =
      targetId === undefined
        ? undefined
        : ({ ids, targetId, edge: before ? 'before' : 'after' } as const)
    return move && canSubmit(move) ? move : undefined
  }

  function candidate({ source, location }: ElementEventBasePayload): ListMove | undefined {
    const target = location.current.dropTargets.find(({ data }) => data.list === scope)
    if (!target) {
      return undefined
    }
    const edge = extractClosestEdge(target.data)
    if (edge !== 'top' && edge !== 'bottom') {
      return undefined
    }

    const move: ListMove = {
      ids: source.data.ids as readonly string[],
      targetId: target.data.id as string,
      edge: edge === 'top' ? 'before' : 'after',
    }
    return canSubmit(move) ? move : undefined
  }

  async function submit(sourceId: string, move: ListMove | undefined) {
    if (!move || !canSubmit(move)) {
      return
    }

    setBusy(true)
    setFeedback('')
    try {
      await local.onMove(move)
      const index = local.order.indexOf(sourceId)
      if (index !== -1 && list.isConnected) {
        setFeedback(local.labels.moved(sourceId, index + 1, move))
      }
    } catch (error) {
      local.onMoveError(error)
    } finally {
      setBusy(false)
      const handle = handleById.get(sourceId)
      if (handle?.isConnected) {
        const document = handle.ownerDocument
        if (document.activeElement === document.body || document.activeElement === handle) {
          handle.focus({ preventScroll: true })
          handle.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        }
      }
    }
  }

  createDragMonitor(() => ({
    canMonitor: ({ source }) => source.data.list === scope,
    onDrag: (event) => setDrop(candidate(event)),
    onDropTargetChange: (event) => setDrop(candidate(event)),
    onDrop: (event) => {
      setDrop(undefined)
      void submit(event.source.data.id as string, candidate(event))
    },
  }))
  createDragAutoScroll(() => ({
    element: local.viewport?.() ?? list,
    canScroll: ({ source }) => source.data.list === scope && !busy(),
  }))

  return (
    <ReorderContext.Provider
      value={{
        scope,
        busy,
        drop,
        labels: () => local.labels,
        handleById,
        subjects,
        command,
        canSubmit,
        submit: (id, move) => void submit(id, move),
      }}
    >
      <List
        {...rest}
        ordered
        data-reorderable
        aria-busy={busy() || undefined}
        ref={(node) => {
          list = node
          assignRef(local.ref, node)
        }}
      />
      <DragFeedback>{feedback()}</DragFeedback>
    </ReorderContext.Provider>
  )
}

/** Provides the owning list to its move-enabled item and rejects detached composition. */
export function useReorderableList() {
  const list = useContext(ReorderContext)
  if (!list) {
    throw new Error('ReorderableListItem requires a ReorderableList.')
  }
  return list
}
