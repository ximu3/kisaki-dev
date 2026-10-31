/** @fileoverview Connects Pragmatic Drag and Drop to Solid owners and shared interaction visuals. */

import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter'
import {
  autoScrollForElements,
  autoScrollWindowForElements,
} from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element'
import { announce, cleanup } from '@atlaskit/pragmatic-drag-and-drop-live-region'
import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import { createEffect, onCleanup, Show, splitProps, type Accessor, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { Button, type ButtonProps } from './components/button'

export {
  attachClosestEdge,
  extractClosestEdge,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
export type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
export type {
  ElementDragPayload,
  ElementEventBasePayload,
  ElementEventPayloadMap,
  ElementDropTargetEventBasePayload,
  ElementDropTargetEventPayloadMap,
  ElementGetFeedbackArgs,
  ElementDropTargetGetFeedbackArgs,
  ElementMonitorGetFeedbackArgs,
} from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter'

/** The library's public drag contract, including a dedicated handle and caller-owned data. */
export type DraggableOptions = Parameters<typeof draggable>[0]
/** The library's public target contract; the host decides whether a real target is ready and allowed. */
export type DropTargetOptions = Parameters<typeof dropTargetForElements>[0]
/** The library's public monitor contract; use a stable view owner when source rows can unmount. */
export type DragMonitorOptions = Parameters<typeof monitorForElements>[0]
/** The library's element scroll contract, including caller-defined eligibility. */
export type DragAutoScrollOptions = Parameters<typeof autoScrollForElements>[0]
/** The library's window scroll contract. */
export type DragWindowAutoScrollOptions = NonNullable<
  Parameters<typeof autoScrollWindowForElements>[0]
>

/** Replace and release drag registration with its reactive options and Solid owner. */
export function createDraggable(options: Accessor<DraggableOptions | undefined>): void {
  createEffect(() => {
    const current = options()
    if (current) {
      onCleanup(draggable(current))
    }
  })
}

/** Register only currently available targets; disposal removes their event handlers. */
export function createDropTarget(options: Accessor<DropTargetOptions | undefined>): void {
  createEffect(() => {
    const current = options()
    if (current) {
      onCleanup(dropTargetForElements(current))
    }
  })
}

/** Keep drag completion and cancellation observable independently of a virtualized source row. */
export function createDragMonitor(options: Accessor<DragMonitorOptions | undefined>): void {
  createEffect(() => {
    const current = options()
    if (current) {
      onCleanup(monitorForElements(current))
    }
  })
}

/** Release automatic scrolling when the container changes or its owner ends. */
export function createDragAutoScroll(options: Accessor<DragAutoScrollOptions | undefined>): void {
  createEffect(() => {
    const current = options()
    if (current) {
      onCleanup(autoScrollForElements(current))
    }
  })
}

/** Opt into window scrolling for the lifetime of this drag view. */
export function createDragWindowAutoScroll(
  options: Accessor<DragWindowAutoScrollOptions | undefined>,
): void {
  createEffect(() => {
    const current = options()
    if (current) {
      onCleanup(autoScrollWindowForElements(current))
    }
  })
}

let announcerOwners = 0

/** Share the library's document live region and release its pending announcement when the last owner ends. */
export function createDragAnnouncer(): (message: string) => void {
  announcerOwners++
  let active = true
  onCleanup(() => {
    active = false
    if (--announcerOwners === 0) {
      cleanup()
    }
  })

  return (message) => {
    if (active) {
      announce(message)
    }
  }
}

/** Activate equivalent move actions with keyboard or click; pointer dragging uses this button as dragHandle. */
export type DragHandleProps = Omit<ButtonProps, 'iconOnly' | 'aria-label' | 'onClick'> & {
  'aria-label': string
  onClick: NonNullable<ButtonProps['onClick']>
}

/** Show a dedicated grip so dragging does not steal text selection from the rest of a row. */
export function DragHandle(props: DragHandleProps): JSX.Element {
  const [local, rest] = splitProps(props, ['children', 'class'])
  return (
    <Button
      variant="ghost"
      size="xs"
      {...rest}
      iconOnly
      class={twMerge('cursor-grab active:cursor-grabbing', local.class)}
    >
      <Show
        when={local.children}
        fallback={
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="4" r="1" />
            <circle cx="11" cy="4" r="1" />
            <circle cx="5" cy="8" r="1" />
            <circle cx="11" cy="8" r="1" />
            <circle cx="5" cy="12" r="1" />
            <circle cx="11" cy="12" r="1" />
          </svg>
        }
      >
        {local.children}
      </Show>
    </Button>
  )
}

/** An insertion edge returned by the library hitbox; null means no valid insertion target. */
export type DropIndicatorProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, 'children'> & {
  edge: Edge | null
}

const edgeClasses: Record<Edge, string> = {
  top: 'inset-x-0 -top-px h-0.5',
  bottom: 'inset-x-0 -bottom-px h-0.5',
  left: 'inset-y-0 -left-px w-0.5',
  right: 'inset-y-0 -right-px w-0.5',
}

/** Mark insertion rather than swapping; the positioned ancestor is the host's actual target row or card. */
export function DropIndicator(props: DropIndicatorProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'edge'])
  return (
    <Show when={local.edge}>
      {(edge) => (
        <div
          {...rest}
          aria-hidden="true"
          class={twMerge(
            'pointer-events-none absolute z-10 rounded-full bg-primary',
            edgeClasses[edge()],
            local.class,
          )}
        />
      )}
    </Show>
  )
}
