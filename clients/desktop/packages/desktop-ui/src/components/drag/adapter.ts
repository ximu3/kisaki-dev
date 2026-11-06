/** @fileoverview Solid lifetimes for Pragmatic Drag and Drop registrations. */

import { createEffect, onCleanup } from 'solid-js'
import type { Accessor } from 'solid-js'
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element'

/** Create in a Solid owner. The accessor runs after DOM refs exist and replaces registration when its inputs change. */
export function createDraggable(
  options: Accessor<Parameters<typeof draggable>[0] | undefined>,
): void {
  createEffect(() => {
    const current = options()
    if (current) {
      const stop = draggable({
        ...current,
        onDragStart: (event) => {
          current.element.dataset.uiDragging = ''
          current.onDragStart?.(event)
        },
        onDrop: (event) => {
          delete current.element.dataset.uiDragging
          current.onDrop?.(event)
        },
      })
      onCleanup(() => {
        stop()
        delete current.element.dataset.uiDragging
      })
    }
  })
}

/** Host canDrop/getData retain business identity, permission, data readiness and ordering ownership. */
export function createDropTarget(
  options: Accessor<Parameters<typeof dropTargetForElements>[0] | undefined>,
): void {
  createEffect(() => {
    const current = options()
    if (current) {
      onCleanup(dropTargetForElements(current))
    }
  })
}

/** Monitor only while its Solid owner exists; registration never commits or reorders host data itself. */
export function createDragMonitor(
  options: Accessor<Parameters<typeof monitorForElements>[0] | undefined>,
): void {
  createEffect(() => {
    const current = options()
    if (current) {
      onCleanup(monitorForElements(current))
    }
  })
}

/** The host supplies the scrolling viewport and drag eligibility; disposal stops registration. */
export function createDragAutoScroll(
  options: Accessor<Parameters<typeof autoScrollForElements>[0] | undefined>,
): void {
  createEffect(() => {
    const current = options()
    if (current) {
      onCleanup(autoScrollForElements(current))
    }
  })
}
