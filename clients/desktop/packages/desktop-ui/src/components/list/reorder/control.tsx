import { createContext, createSignal, onCleanup, omit, useContext } from 'solid-js'
import type { ElementEventBasePayload } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import { createDragAutoScroll, createDragMonitor } from '../../drag/adapter'
import { DragFeedback } from '../../drag/presentation'
import { List, type ListProps } from '../parts'
import { moveListItems, type ListMove } from './move'

export type MoveCommand = 'first' | 'previous' | 'next' | 'last'

export interface ReorderLabels {
  first: string
  previous: string
  next: string
  last: string
  moved: (sourceId: string, position: number, move: ListMove) => string
}

export interface ReorderableListProps extends Omit<ListProps, 'ordered'> {
  order: readonly string[]
  selected?: ReadonlySet<string>
  labels: ReorderLabels
  viewport?: () => HTMLElement | undefined
  canMove?: (move: ListMove) => boolean
  onMove: (move: ListMove) => void | Promise<void>
  onMoveError: (reason: unknown) => void
}

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

export function ReorderableList(props: ReorderableListProps) {
  const rest = omit(
    props,
    'order',
    'selected',
    'labels',
    'viewport',
    'canMove',
    'onMove',
    'onMoveError',
    'ref',
  )
  const [busy, setBusy] = createSignal(false)
  const [drop, setDrop] = createSignal<ListMove>()
  const [feedback, setFeedback] = createSignal('')
  const scope = Symbol()
  const handleById = new Map<string, HTMLButtonElement>()
  let list!: HTMLUListElement | HTMLOListElement
  onCleanup(() => handleById.clear())

  function subjects(id: string) {
    const selected = props.selected
    return selected?.has(id) ? props.order.filter((item) => selected.has(item)) : [id]
  }

  function canSubmit(move: ListMove) {
    const order = props.order
    return !busy() && moveListItems(order, move) !== order && (props.canMove?.(move) ?? true)
  }

  function command(id: string, direction: MoveCommand) {
    const order = props.order
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
      await props.onMove(move)
      const index = props.order.indexOf(sourceId)
      if (index !== -1 && list.isConnected) {
        setFeedback(props.labels.moved(sourceId, index + 1, move))
      }
    } catch (error) {
      props.onMoveError(error)
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
  createDragAutoScroll(() => {
    const element = props.viewport?.()
    if (!element) {
      return
    }
    return { element, canScroll: ({ source }) => source.data.list === scope && !busy() }
  })

  return (
    <ReorderContext
      value={{
        scope,
        busy,
        drop,
        labels: () => props.labels,
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
        aria-busy={busy() ? 'true' : undefined}
        ref={[
          (node) => {
            list = node
          },
          props.ref,
        ]}
      />
      <DragFeedback>{feedback()}</DragFeedback>
    </ReorderContext>
  )
}

export function useReorderableList() {
  return useContext(ReorderContext)
}
