/** @fileoverview Public drag registration, handles, insertion markers and feedback. */

export {
  createDraggable,
  createDropTarget,
  createDragMonitor,
  createDragAutoScroll,
} from './adapter'
export { setDragPreview } from './preview'
export {
  DragHandle,
  DropIndicator,
  DragFeedback,
  type DragHandleProps,
  type DropIndicatorProps,
} from './presentation'

export {
  attachClosestEdge,
  extractClosestEdge,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
export type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/types'
