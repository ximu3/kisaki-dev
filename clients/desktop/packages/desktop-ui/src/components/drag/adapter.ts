/** @fileoverview Solid lifetimes for Pragmatic Drag and Drop registrations. */

import { createEffect, onCleanup } from 'solid-js'
import type { Accessor } from 'solid-js'
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element'

/**
 * Registers a draggable reactively under the current Solid owner.
 *
 * Input changes replace registration; cleanup removes registration and the active-drag presentation
 * marker.
 */
export function createDraggable(
  options: Accessor<Parameters<typeof draggable>[0] | undefined>,
): void {
  createEffect(() => {
    const current = options()
    if (current) {
      /** Library disposer for the active drag-source registration. */
      const stop = draggable({
        ...current,

        /** Marks the source as dragging before forwarding the native start notification. */
        onDragStart: (event) => {
          current.element.dataset.uiDragging = ''
          current.onDragStart?.(event)
        },

        /** Clears source drag presentation before forwarding the native drop notification. */
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

/**
 * Registers a drop target reactively and releases it with the Solid owner.
 *
 * The host's callbacks own business identity, permission, data readiness and ordering.
 */
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

/**
 * Registers a reactive drag monitor for the current Solid lifetime.
 *
 * Host callbacks decide whether and how a drop changes data.
 */
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

/**
 * Registers auto-scrolling for the host's viewport and drag-eligibility rules.
 *
 * Input changes replace registration, and owner cleanup stops it.
 */
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
