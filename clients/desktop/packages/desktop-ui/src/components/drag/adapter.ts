import { createSignal, createEffect, onSettled, type Accessor } from 'solid-js'
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element'

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

export function createDropTarget(
  options: Accessor<Parameters<typeof dropTargetForElements>[0] | undefined>,
): void {
  registerAfterMount(options, dropTargetForElements)
}

export function createDragMonitor(
  options: Accessor<Parameters<typeof monitorForElements>[0] | undefined>,
): void {
  registerAfterMount(options, monitorForElements)
}

export function createDragAutoScroll(
  options: Accessor<Parameters<typeof autoScrollForElements>[0] | undefined>,
): void {
  registerAfterMount(options, autoScrollForElements)
}
