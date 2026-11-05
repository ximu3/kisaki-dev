/** @fileoverview A stable reorder owner spans virtual rows and validates real targets at delivery. */

import { createEffect, createSignal, onCleanup, type Accessor } from 'solid-js'
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter'
import {
  attachClosestEdge,
  extractClosestEdge,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element'
import { announce, cleanup } from '@atlaskit/pragmatic-drag-and-drop-live-region'
import type { ElementEventBasePayload } from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter'

export type DropEdge = 'top' | 'bottom' | 'left' | 'right'
export interface MoveTarget {
  targetId: string
  position: 'before' | 'after'
}

export interface MoveIntent extends MoveTarget {
  sourceIds: readonly string[]
}

export interface DragOptions {
  /** Resolve the ordered group once at pickup, including the source item. */
  sources?: (sourceId: string) => readonly string[]
  canMove?: (intent: MoveIntent) => boolean
  /** Accepted drop or equivalent keyboard action. The host owns the write and its outcome. */
  onMove: (intent: MoveIntent) => void
}

export interface DragController {
  readonly dragging: Accessor<readonly string[]>
  readonly indicator: Accessor<{ targetId: string; edge: DropEdge } | undefined>
  /** Register from the row owner. Returning undefined removes that registration. */
  source: (handle: Accessor<HTMLElement | undefined>, id: Accessor<string | undefined>) => void
  target: (
    element: Accessor<HTMLElement | undefined>,
    id: Accessor<string | undefined>,
    axis?: Accessor<'vertical' | 'horizontal'>,
  ) => void
  /** The stable scroll container remains a drop surface even when source rows unmount. */
  scrollArea: (element: Accessor<HTMLElement | undefined>) => void
  canMove: (sourceId: string, target: MoveTarget) => boolean
  move: (sourceId: string, target: MoveTarget) => void
  /** Announce host-supplied instructions or actual results while this owner is live. */
  announce: (text: string) => void
}

let liveOwners = 0

/** Create inside the Solid owner of the reorder surface. The host commits each accepted move. */
export function createDragController(options: DragOptions): DragController {
  const scope = Symbol('reorder scope')
  const [dragging, setDragging] = createSignal<readonly string[]>([])
  const [indicator, setIndicator] = createSignal<{ targetId: string; edge: DropEdge }>()
  const [live, setLive] = createSignal(true)
  liveOwners++

  const sources = (id: string) => options.sources?.(id) ?? [id]

  /** Check the host's current permission for this ordered group and destination. */
  function allowed(intent: MoveIntent): boolean {
    return (
      live() &&
      intent.sourceIds.length > 0 &&
      !intent.sourceIds.includes(intent.targetId) &&
      (options.canMove?.(intent) ?? true)
    )
  }

  /** Resolve the innermost registered target from the latest drag location. */
  function insertion(event: ElementEventBasePayload) {
    const data = event.location.current.dropTargets.find(
      (target) => target.data.scope === scope,
    )?.data
    if (!data || typeof data.id !== 'string') {
      return
    }
    const edge = extractClosestEdge(data)
    if (!edge) {
      return
    }
    const intent: MoveIntent = {
      sourceIds: dragging(),
      targetId: data.id,
      position: edge === 'top' || edge === 'left' ? 'before' : 'after',
    }
    if (allowed(intent)) {
      return { intent, edge }
    }
  }

  /** Expose the eligible edge for the target row's insertion marker. */
  function indicate(event: ElementEventBasePayload): void {
    const next = insertion(event)
    setIndicator(next && { targetId: next.intent.targetId, edge: next.edge })
  }

  const stop = monitorForElements({
    canMonitor: ({ source }) => source.data.scope === scope,
    onDragStart(event) {
      setDragging(event.source.data.ids as readonly string[])
      indicate(event)
    },
    onDrag: indicate,
    onDropTargetChange: indicate,
    onDrop(event) {
      const next = insertion(event)
      setDragging([])
      setIndicator(undefined)
      if (next) {
        options.onMove(next.intent)
      }
    },
  })
  onCleanup(() => {
    setLive(false)
    stop()
    setDragging([])
    setIndicator(undefined)
    if (--liveOwners === 0) {
      cleanup()
    }
  })

  return {
    dragging,
    indicator,
    source(handle, getId) {
      createEffect(() => {
        const element = handle()
        const id = getId()
        if (live() && element && id !== undefined) {
          onCleanup(
            draggable({ element, getInitialData: () => ({ scope, ids: [...sources(id)] }) }),
          )
        }
      })
    },
    target(getElement, getId, axis) {
      createEffect(() => {
        const element = getElement()
        const id = getId()
        if (!live() || !element || id === undefined) {
          return
        }
        const edges: DropEdge[] = axis?.() === 'horizontal' ? ['left', 'right'] : ['top', 'bottom']
        onCleanup(() => setIndicator((current) => (current?.targetId === id ? undefined : current)))
        onCleanup(
          dropTargetForElements({
            element,
            canDrop: ({ source, input }) => {
              if (source.data.scope !== scope) {
                return false
              }
              const edge = extractClosestEdge(
                attachClosestEdge({}, { element, input, allowedEdges: edges }),
              )
              return allowed({
                sourceIds: source.data.ids as readonly string[],
                targetId: id,
                position: edge === 'top' || edge === 'left' ? 'before' : 'after',
              })
            },
            getData: ({ input }) =>
              attachClosestEdge({ scope, id }, { element, input, allowedEdges: edges }),
          }),
        )
      })
    },
    scrollArea(getElement) {
      createEffect(() => {
        const element = getElement()
        if (!live() || !element) {
          return
        }
        onCleanup(
          dropTargetForElements({ element, canDrop: ({ source }) => source.data.scope === scope }),
        )
        onCleanup(
          autoScrollForElements({
            element,
            canScroll: ({ source }) => source.data.scope === scope,
          }),
        )
      })
    },
    canMove(id, target) {
      return allowed({ ...target, sourceIds: sources(id) })
    },
    move(id, target) {
      const intent = { ...target, sourceIds: sources(id) }
      if (allowed(intent)) {
        options.onMove(intent)
      }
    },
    announce(text) {
      if (live()) {
        announce(text)
      }
    },
  }
}
