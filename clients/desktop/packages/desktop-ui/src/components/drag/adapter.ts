/** @fileoverview Solid lifetimes for Pragmatic Drag and Drop registrations. */

import { createEffect, onCleanup } from 'solid-js'
import type { Accessor } from 'solid-js'
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'

/** Create in a Solid owner. The accessor runs after DOM refs exist and replaces registration when its inputs change. */
export function createDraggable(
  options: Accessor<Parameters<typeof draggable>[0] | undefined>,
): void {
  createEffect(() => {
    const current = options()
    if (current) {
      onCleanup(draggable(current))
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
