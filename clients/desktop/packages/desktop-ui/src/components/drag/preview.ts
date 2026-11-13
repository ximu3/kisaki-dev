/** @fileoverview Compact native drag images use the toolkit's capture and cleanup lifecycle. */

import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/utils/set-custom-native-drag-preview'
import { pointerOutsideOfPreview } from '@atlaskit/pragmatic-drag-and-drop/utils/pointer-outside-of-preview'
import { classes } from '../../internal/dom'
import surface from '../../internal/popup/surface.module.css'
import styles from './styles.module.css'

/**
 * Creates a compact text drag image using the toolkit's capture and cleanup lifecycle.
 *
 * The host calls it from onGenerateDragPreview with a description of the moved selection.
 */
export function setDragPreview(options: {
  /** Sets the browser drag image for the current preview-generation event. */
  nativeSetDragImage: Parameters<typeof setCustomNativeDragPreview>[0]['nativeSetDragImage']
  label: string
}): void {
  setCustomNativeDragPreview({
    nativeSetDragImage: options.nativeSetDragImage,
    getOffset: pointerOutsideOfPreview({ x: '12px', y: '8px' }),

    /** Creates the labeled preview inside the library-owned native drag-image container. */
    render: ({ container }) => {
      const preview = container.ownerDocument.createElement('div')
      preview.className = classes(surface.staticSurface, styles.preview)
      preview.textContent = options.label
      container.append(preview)
    },
  })
}
