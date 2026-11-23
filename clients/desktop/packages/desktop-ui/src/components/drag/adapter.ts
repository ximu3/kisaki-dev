import { createSignal, createEffect, onSettled } from 'solid-js'
import type { Accessor } from 'solid-js'
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element'

/**
 * Reads DOM-dependent options once refs are assigned, then replaces each registration when its
 * reactive inputs change.
 */
function registerAfterMount<T>(
  options: Accessor<T | undefined>,
  register: (current: T) => () => void,
): void {
  const [mounted, setMounted] = createSignal(false)
  onSettled(() => {
    setMounted(true)
  })
  createEffect(
    () => (mounted() ? options() : undefined),
    (current) => (current === undefined ? undefined : register(current)),
  )
}

/**
 * Registers a draggable reactively under the current Solid owner.
 *
 * Input changes replace registration; cleanup removes registration and the active-drag presentation
 * marker.
 */
export function createDraggable(
  options: Accessor<Parameters<typeof draggable>[0] | undefined>,
): void {
  registerAfterMount(options, (current) => {
    const stop = draggable({
      ...current,

      // Put start callbacks inside the dragging state.
      onDragStart: (event) => {
        current.element.dataset.uiDragging = ''
        current.onDragStart?.(event)
      },

      // Clear drag presentation before the caller handles the drop.
      onDrop: (event) => {
        delete current.element.dataset.uiDragging
        current.onDrop?.(event)
      },
    })

    return () => {
      stop()
      delete current.element.dataset.uiDragging
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
  registerAfterMount(options, dropTargetForElements)
}

/**
 * Registers a reactive drag monitor for the current Solid lifetime.
 *
 * Host callbacks decide whether and how a drop changes data.
 */
export function createDragMonitor(
  options: Accessor<Parameters<typeof monitorForElements>[0] | undefined>,
): void {
  registerAfterMount(options, monitorForElements)
}

/**
 * Registers auto-scrolling for the host's viewport and drag-eligibility rules.
 *
 * Input changes replace registration, and owner cleanup stops it.
 */
export function createDragAutoScroll(
  options: Accessor<Parameters<typeof autoScrollForElements>[0] | undefined>,
): void {
  registerAfterMount(options, autoScrollForElements)
}
